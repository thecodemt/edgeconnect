import os
import base64
import cv2
import numpy as np
from flask import Flask, request, jsonify, render_template
from PIL import Image
import io
import sys
import torch
import torchvision.transforms.functional as F
from skimage import feature
sys.path.append('..')
from src.edge_connect import EdgeConnect
from src.models import EdgeModel, InpaintingModel
from src.config import Config
from src.utils import imsave

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# 初始化模型
config = Config('./celeba/config.yml')
edge_model = EdgeModel(config)
inpainting_model = InpaintingModel(config)

edge_model.load()
inpainting_model.load()

edge_model.eval()
inpainting_model.eval()

def resize_to_multiple_of_8(image):
    """将图像调整为8的倍数大小"""
    H, W = image.shape[:2]
    new_H = (H + 7) // 8 * 8
    new_W = (W + 7) // 8 * 8
    return cv2.resize(image, (new_W, new_H), interpolation=cv2.INTER_LINEAR)

def preprocess_image(image_data):
    """预处理图像数据"""
    try:
        # 解码base64图像数据
        image_data = base64.b64decode(image_data.split(',')[1])
        image = Image.open(io.BytesIO(image_data))
        image = np.array(image)
        
        # 确保图像为RGB格式
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            image = cv2.cvtColor(image, cv2.COLOR_RGBA2RGB)
        
        return image
    except Exception as e:
        raise ValueError(f"图像预处理失败: {str(e)}")

def process_image(image_path):
    """处理输入图像，生成边缘和灰度图"""
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("无法读取图像文件")
        
    image = cv2.resize(image, (512, 512))
    gray_image = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    edges = feature.canny(gray_image, sigma=1.0)
    image = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    
    return image, gray_image, edges

def save_debug_images(image, mask, edges, gray_image):
    """保存调试用的中间图像"""
    Image.fromarray(image).save(os.path.join(app.config['UPLOAD_FOLDER'], 'image.png'))
    Image.fromarray(mask).save(os.path.join(app.config['UPLOAD_FOLDER'], 'mask.png'))
    Image.fromarray(edges).save(os.path.join(app.config['UPLOAD_FOLDER'], 'edges.png'))
    Image.fromarray(gray_image).save(os.path.join(app.config['UPLOAD_FOLDER'], 'gray_image.png'))

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/inpaint', methods=['POST'])
def inpaint():
    try:
        # 获取并验证输入
        if 'image' not in request.files:
            raise ValueError("未找到上传的图像文件")
        if 'mask' not in request.form:
            raise ValueError("未找到遮罩数据")
            
        image_file = request.files['image']
        mask_data = request.form['mask']
        
        # 保存并处理输入图像
        image_path = os.path.join(app.config['UPLOAD_FOLDER'], 'input.jpg')
        image_file.save(image_path)

        # 获取原始图像大小
        image=cv2.imread(image_path)
        original_size = (image.shape[1], image.shape[0])
        
        # 处理图像和遮罩
        image, gray_image, edges = process_image(image_path)
        mask = preprocess_image(mask_data)
        mask = cv2.resize(mask, (image.shape[1], image.shape[0]))
        
        # 处理遮罩
        mask = cv2.cvtColor(mask, cv2.COLOR_RGB2GRAY)
        _, mask = cv2.threshold(mask, 127, 255, cv2.THRESH_BINARY)
        
        # 转换为张量
        image_tensor = F.to_tensor(Image.fromarray(image)).unsqueeze(0)
        mask_tensor = F.to_tensor(Image.fromarray(mask)).unsqueeze(0)
        edges_tensor = F.to_tensor(Image.fromarray(edges)).unsqueeze(0)
        gray_image_tensor = F.to_tensor(Image.fromarray(gray_image)).unsqueeze(0)
        
        # 保存调试图像
        save_debug_images(image, mask, edges, gray_image)
        
        # 执行修复
        with torch.no_grad():
            edges_tensor = edge_model(gray_image_tensor, edges_tensor, mask_tensor)
            outputs = inpainting_model(image_tensor, edges_tensor, mask_tensor)
            outputs_merged = (outputs * mask_tensor) + (image_tensor * (1 - mask_tensor))
            outputs_merged = (outputs_merged * 255.0).permute(0, 2, 3, 1).int()
            
        # 保存结果
        result_path = os.path.join(app.config['UPLOAD_FOLDER'], 'result.png')
        imsave(outputs_merged[0], result_path)

        # 返回结果
        result = cv2.imread(result_path)
        result = cv2.resize(result, original_size)
        cv2.imwrite(result_path, result)
        _, buffer = cv2.imencode('.png', result)
        result_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return jsonify({
            'success': True,
            'image': f'data:image/png;base64,{result_base64}'
        })
        
    except Exception as e:
        app.logger.error(f"处理失败: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000) 