# EdgeConnect

EdgeConnect是一个用于图像修复和边缘检测的深度学习模型。该项目实现了一个联合模型，可以同时进行边缘检测和图像修复。

## 项目结构

- `main.py`: 主程序入口，负责启动模型的训练、测试和评估。
- `src/`: 包含模型、数据集、配置和工具的源代码。
  - `edge_connect.py`: 定义了EdgeConnect模型的核心逻辑。
  - `models.py`: 包含生成器和判别器的定义。
  - `dataset.py`: 数据集加载和处理。
  - `config.py`: 配置文件的加载和处理。
  - `utils.py`: 辅助工具函数。
- `scripts/`: 包含一些辅助脚本。
  - `download_model.sh`: 下载预训练模型的脚本。
  - `inception.py`: 用于计算Inception特征的脚本。
- `examples/`: 示例数据，包括CelebA、Places2和PSV数据集的图像和掩码。
- `requirements.txt`: 项目依赖的Python库列表。

## 安装

1. 克隆仓库：
   ```bash
   git clone https://github.com/thecodemt/edgeconnect.git
   cd edgeconnect