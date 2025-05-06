import os
import base64
import cv2
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image
import io
import sys
sys.path.append('..')
from src.edge_connect import EdgeConnect
from src.models import EdgeModel, InpaintingModel
import torch
import torchvision.transforms.functional as F
from skimage import feature
from src.config import Config
from src.utils import imsave

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 初始化模型
#model = EdgeConnect()
#model.load_weights('../checkpoints/edge_connect.pth')
config_path = './places2/config.yml'
config = Config(config_path)

edgeModel = EdgeModel(config)
inpaintingModel = InpaintingModel(config)

edgeModel.load()
inpaintingModel.load()

edgeModel.eval()
inpaintingModel.eval()

def resize_to_multiple_of_8(image):
    # 获取当前图像的高度和宽度
    H, W, C = image.shape
    
    # 计算需要调整的目标高度和宽度，使其是8的倍数
    new_H = (H + 7) // 8 * 8  # 向上调整到8的倍数
    new_W = (W + 7) // 8 * 8  # 向上调整到8的倍数
    
    # 调整图像尺寸
    resized_image = cv2.resize(image, (new_W, new_H), interpolation=cv2.INTER_LINEAR)
    
    return resized_image

def preprocess_image(image_data):
    # 将base64图像数据转换为numpy数组
    image_data = base64.b64decode(image_data.split(',')[1])
    image = Image.open(io.BytesIO(image_data))
    image = np.array(image)
    
    # 转换为RGB格式
    if len(image.shape) == 2:
        image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
    elif image.shape[2] == 4:
        image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
    
    return image

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inpaint', methods=['POST'])
def inpaint():
    try:
        # 获取上传的图像和遮罩
        image_file = request.files['image']
        mask_data = request.form['mask']

        print(type(image_file))
        print(type(mask_data))
        
        # 保存原始图像
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'input.jpg')
        image_file.save(image_path)
        
        # 预处理图像和遮罩
        image = cv2.imread(image_path)
        image = resize_to_multiple_of_8(image)
        gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
        edges = feature.canny(gray_image, sigma=1.0)
        image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
        mask = preprocess_image(mask_data)
        mask = resize_to_multiple_of_8(mask)
        
        # 确保图像和遮罩大小一致
        if image.shape[:2] != mask.shape[:2]:
            mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
        
        # 将遮罩转换为二值图像
        mask = cv2.cvtColor(mask, cv2.COLOR_RGB2GRAY)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)

        image_pil = Image.fromarray(image)
        mask_pil = Image.fromarray(mask)
        edges_pil = Image.fromarray(edges)
        gray_image_pil = Image.fromarray(gray_image)

        image_tensor = F.to_tensor(image_pil).unsqueeze(0)
        mask_tensor = F.to_tensor(mask_pil).unsqueeze(0)
        edges_tensor = F.to_tensor(edges_pil).unsqueeze(0)
        gray_image_tensor = F.to_tensor(gray_image_pil).unsqueeze(0)

        mask_pil.save(os.path.join(app.config['UPLOAD_FOLDER'], 'mask.png'))
        image_pil.save(os.path.join(app.config['UPLOAD_FOLDER'], 'image.png'))
        edges_pil.save(os.path.join(app.config['UPLOAD_FOLDER'], 'edges.png'))
        gray_image_pil.save(os.path.join(app.config['UPLOAD_FOLDER'], 'gray_image.png'))

        edges_tensor = edgeModel(gray_image_tensor,edges_tensor,mask_tensor).detach()
        outputs = inpaintingModel(image_tensor,edges_tensor,mask_tensor).detach()
        outputs_merged = (outputs * mask_tensor)+(image_tensor*(1-mask_tensor))
        outputs_merged = outputs_merged*255.0
        outputs_merged = outputs_merged.permute(0, 2, 3, 1)
        outputs_merged = outputs_merged.int()
        imsave(outputs_merged[0],'./uploads/result.png')


        
        # 执行图像修复
        result = cv2.imread('./uploads/result.png')
        
        # 将结果转换为base64
        _, buffer = cv2.imencode('.png', result)
        result_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{result_base64}'
        })
        
    except Exception as e:
        print(e)
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 