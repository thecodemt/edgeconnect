/**
 * EdgeConnect 图像修复 Web 应用
 * 主要功能：
 * 1. 图像上传和显示
 * 2. 遮罩绘制
 * 3. 图像修复
 * 4. 结果展示和下载
 */
document.addEventListener('DOMContentLoaded', () => {
    // 获取DOM元素
    const canvas = document.getElementById('drawingCanvas');          // 主画布，用于显示原图和遮罩预览
    const ctx = canvas.getContext('2d');                             // 主画布的绘图上下文
    const imageUpload = document.getElementById('imageUpload');      // 图像上传输入框
    const maskUpload = document.getElementById('maskUpload');        // 遮罩上传输入框
    const brushSizeBtn = document.getElementById('brushSize');       // 画笔大小切换按钮
    const clearMaskBtn = document.getElementById('clearMask');       // 清除遮罩按钮
    const submitBtn = document.getElementById('submitBtn');          // 开始修复按钮
    const downloadBtn = document.getElementById('downloadBtn');      // 下载结果按钮
    const originalImage = document.getElementById('originalImage');  // 原图预览
    const maskImage = document.getElementById('maskImage');          // 遮罩预览
    const resultImage = document.getElementById('resultImage');      // 修复结果预览

    // 状态变量
    let isDrawing = false;                                          // 是否正在绘制遮罩
    let brushSize = 5;                                             // 画笔大小（像素）
    let originalImageData = null;                                   // 原始图像数据
    let maskCanvas = document.createElement('canvas');              // 遮罩画布
    let maskCtx = maskCanvas.getContext('2d');                      // 遮罩画布的绘图上下文
    let previewCanvas = document.createElement('canvas');           // 预览画布
    let previewCtx = previewCanvas.getContext('2d');                // 预览画布的绘图上下文
    let currentImage = null;                                        // 当前加载的图像对象
    let imageScale = 1;                                             // 图像缩放比例

    // 初始化画笔大小按钮文本
    brushSizeBtn.textContent = `画笔大小: ${brushSize}px`;

    /**
     * 调整画布大小以适应图像
     * 保持图像原始宽高比，同时确保画布不会超出容器
     */
    function resizeCanvas() {
        if (!currentImage) return;

        const wrapper = canvas.parentElement;
        const wrapperWidth = wrapper.clientWidth;
        const wrapperHeight = wrapper.clientHeight;

        // 计算图像缩放比例
        const imageRatio = currentImage.width / currentImage.height;
        const wrapperRatio = wrapperWidth / wrapperHeight;

        let canvasWidth, canvasHeight;
        if (imageRatio > wrapperRatio) {
            // 图像更宽，以容器宽度为基准
            canvasWidth = wrapperWidth;
            canvasHeight = wrapperWidth / imageRatio;
        } else {
            // 图像更高，以容器高度为基准
            canvasHeight = wrapperHeight;
            canvasWidth = wrapperHeight * imageRatio;
        }

        // 设置所有画布的大小
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        maskCanvas.width = canvasWidth;
        maskCanvas.height = canvasHeight;
        previewCanvas.width = canvasWidth;
        previewCanvas.height = canvasHeight;

        // 计算缩放比例
        imageScale = canvasWidth / currentImage.width;

        // 清除所有画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        maskCtx.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);

        // 绘制原图到预览画布
        previewCtx.drawImage(currentImage, 0, 0, canvas.width, canvas.height);
        
        // 初始化遮罩画布为全黑
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskImage.src = maskCanvas.toDataURL('image/png');

        // 将预览画布内容复制到主画布
        ctx.drawImage(previewCanvas, 0, 0);
    }

    /**
     * 更新预览效果
     * 将原图和遮罩合成显示
     */
    function updatePreview() {
        if (!currentImage) return;

        // 清除预览画布
        previewCtx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
        
        // 绘制原图
        previewCtx.drawImage(currentImage, 0, 0, previewCanvas.width, previewCanvas.height);
        
        // 设置混合模式为source-over
        previewCtx.globalCompositeOperation = 'source-over';

        // 获取 maskCanvas 的图像数据
        var imageData = maskCtx.getImageData(0, 0, maskCanvas.width, maskCanvas.height);
        var data = imageData.data;

        // 遍历所有像素
        for (var i = 0; i < data.length; i += 4) {
            // 每个像素有四个值：R, G, B, A（红绿蓝透明度）
            var r = data[i];     // 红色通道
            var g = data[i + 1]; // 绿色通道
            var b = data[i + 2]; // 蓝色通道

            // 检查是否为黑色
            if (r === 0 && g === 0 && b === 0) {
                // 将黑色部分的透明度设置为 0（透明）
                data[i + 3] = 0; // 设置 alpha 通道为 0
            } else if (r === 255 && g === 255 && b === 255) {
                // 将白色部分的透明度设置为 255（完全不透明）
                data[i + 3] = 255; // 设置 alpha 通道为 255
            }
        }

        // 将修改后的像素数据放回画布
        maskCtx.putImageData(imageData, 0, 0);


        // 在遮罩区域绘制白色
        previewCtx.fillStyle = 'white';
        previewCtx.drawImage(maskCanvas, 0, 0);

        // 遍历所有像素
        for (var i = 0; i < data.length; i += 4) {
            var a = data[i + 3];  // alpha 通道（透明度）

            // 检查是否是透明像素
            if (a === 0) {
                // 如果是透明像素，将其变为黑色
                data[i] = 0;     // 红色通道为黑色
                data[i + 1] = 0; // 绿色通道为黑色
                data[i + 2] = 0; // 蓝色通道为黑色
                data[i + 3] = 255; // alpha 通道为 255（完全不透明）
            }
        }

        // 将修改后的像素数据放回画布
        maskCtx.putImageData(imageData, 0, 0);
        
        // 将预览效果绘制到主画布
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(previewCanvas, 0, 0);
        
        // 重置混合模式
        previewCtx.globalCompositeOperation = 'source-over';
    }

    /**
     * 加载图像到画布
     * @param {File} file - 要加载的图像文件
     */
    function loadImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                currentImage = img;
                originalImageData = e.target.result;
                
                // 调整画布大小
                resizeCanvas();
                
                // 显示原图预览
                originalImage.src = e.target.result;
                
                // 确保图像显示
                console.log('Image loaded:', img.width, 'x', img.height);
                console.log('Canvas size:', canvas.width, 'x', canvas.height);
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    /**
     * 绘制遮罩
     * @param {MouseEvent} e - 鼠标事件对象
     */
    function draw(e) {
        if (!isDrawing || !currentImage) return;
        
        const rect = canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left);
        const y = (e.clientY - rect.top);
        
        // 在遮罩画布上绘制白色
        maskCtx.fillStyle = 'white';
        maskCtx.beginPath();
        maskCtx.arc(x, y, brushSize, 0, Math.PI * 2);
        maskCtx.fill();
        
        // 更新遮罩预览
        maskImage.src = maskCanvas.toDataURL('image/png');
        
        // 更新预览效果
        updatePreview();
    }

    // 鼠标事件监听器
    canvas.addEventListener('mousedown', () => isDrawing = true);    // 开始绘制
    canvas.addEventListener('mouseup', () => isDrawing = false);     // 结束绘制
    canvas.addEventListener('mousemove', draw);                      // 绘制过程
    canvas.addEventListener('mouseleave', () => isDrawing = false);  // 鼠标离开画布

    // 图像上传事件处理
    imageUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            loadImage(e.target.files[0]);
        }
    });

    // 画笔大小切换
    brushSizeBtn.addEventListener('click', () => {
        brushSize = brushSize === 5 ? 10 : 5;
        brushSizeBtn.textContent = `画笔大小: ${brushSize}px`;
    });

    // 清除遮罩
    clearMaskBtn.addEventListener('click', () => {
        // 清除遮罩画布
        maskCtx.fillStyle = 'black';
        maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
        maskImage.src = maskCanvas.toDataURL('image/png');
        
        // 更新预览效果
        updatePreview();
    });

    /**
     * 加载遮罩图像
     * @param {File} file - 要加载的遮罩图像文件
     */
    function loadMask(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // 调整遮罩画布大小
                maskCanvas.width = canvas.width;
                maskCanvas.height = canvas.height;
                
                // 清除遮罩画布
                maskCtx.fillStyle = 'black';
                maskCtx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
                
                // 绘制遮罩图像
                maskCtx.drawImage(img, 0, 0, maskCanvas.width, maskCanvas.height);
                
                // 更新遮罩预览
                maskImage.src = maskCanvas.toDataURL('image/png');
                
                // 更新预览效果
                updatePreview();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }

    // 遮罩上传事件处理
    maskUpload.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            loadMask(e.target.files[0]);
        }
    });

    // 提交修复请求
    submitBtn.addEventListener('click', async () => {
        if (!originalImageData) {
            alert('请先上传图像');
            return;
        }

        const formData = new FormData();
        formData.append('image', imageUpload.files[0]);
        formData.append('mask', maskCanvas.toDataURL('image/png'));

        // 显示加载动画
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading';
        loadingDiv.innerHTML = `
            <div class="spinner-border loading-spinner text-primary" role="status">
                <span class="visually-hidden">加载中...</span>
            </div>
        `;
        document.body.appendChild(loadingDiv);

        try {
            const response = await fetch('/inpaint', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error('修复请求失败');
            }

            const result = await response.json();
            if (result.success) {
                resultImage.src = result.image;
                downloadBtn.disabled = false;
            } else {
                alert('修复失败：' + result.error);
            }
        } catch (error) {
            alert('发生错误：' + error.message);
        } finally {
            loadingDiv.remove();
        }
    });

    // 下载结果
    downloadBtn.addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'repaired_image.png';
        link.href = resultImage.src;
        link.click();
    });

    // 监听窗口大小变化，调整画布大小
    window.addEventListener('resize', resizeCanvas);
});