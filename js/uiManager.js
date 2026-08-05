/**
 * Handles UI, Pan/Zoom Viewport, and Layer Render Pipeline
 */
export class UIManager {
  constructor(layerManager) {
    this.layerManager = layerManager;
    this.canvas = document.getElementById('nft-preview-canvas');
    this.ctx = this.canvas.getContext('2d');
    this.zoomLevel = 1.0;
    
    this.initViewportControls();
  }

  initViewportControls() {
    document.getElementById('btn-zoom-in').addEventListener('click', () => this.setZoom(0.1));
    document.getElementById('btn-zoom-out').addEventListener('click', () => this.setZoom(-0.1));
    document.getElementById('btn-zoom-reset').addEventListener('click', () => {
      this.zoomLevel = 1.0;
      this.applyZoom();
    });
  }

  setZoom(delta) {
    this.zoomLevel = Math.max(0.2, Math.min(3.0, this.zoomLevel + delta));
    this.applyZoom();
  }

  applyZoom() {
    const wrapper = document.getElementById('canvas-wrapper');
    wrapper.style.transform = `scale(${this.zoomLevel})`;
  }

  /**
   * Renders composite layered NFT preview to HTML5 Canvas
   * @param {Array} traitSelection - Array containing traits to compose
   */
  async renderPreview(traitSelection) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    for (const trait of traitSelection) {
      if (trait.asset && trait.asset.bitmap) {
        this.ctx.drawImage(
          trait.asset.bitmap, 
          0, 0, 
          this.canvas.width, 
          this.canvas.height
        );
      }
    }
  }

  updateLayerTreeUI(order, onReorder) {
    const treeList = document.getElementById('layer-tree-list');
    treeList.innerHTML = '';

    order.forEach((layerName, index) => {
      const li = document.createElement('li');
      li.textContent = `${index + 1}. ${layerName}`;
      li.draggable = true;
      
      // Basic Drag and Drop implementation for Layer re-ordering
      li.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', index);
      });

      li.addEventListener('dragover', (e) => e.preventDefault());

      li.addEventListener('drop', (e) => {
        e.preventDefault();
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'), 10);
        const toIdx = index;

        const updatedOrder = [...order];
        const [moved] = updatedOrder.splice(fromIdx, 1);
        updatedOrder.splice(toIdx, 0, moved);

        onReorder(updatedOrder);
      });

      treeList.appendChild(li);
    });
  }

  updateMetadataPreview(json) {
    document.getElementById('json-preview-box').textContent = JSON.stringify(json, null, 2);
  }

  logConsole(msg) {
    const box = document.getElementById('console-log-box');
    const entry = document.createElement('div');
    entry.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
    box.appendChild(entry);
    box.scrollTop = box.scrollHeight;
  }
}
