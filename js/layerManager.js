/**
 * Ingests layer archives and organizes image assets for generation
 */
export class LayerManager {
  constructor() {
    this.layers = new Map(); // Key: Layer Name, Value: Array of Trait Assets
    this.layerOrder = [];
  }

  /**
   * Process ZIP assets into accessible Data URLs/Blobs
   * @param {Object} zipFiles 
   * @param {Array} preferredOrder 
   */
  async processLayerZip(zipFiles, preferredOrder = []) {
    this.layers.clear();

    for (const path in zipFiles) {
      const file = zipFiles[path];
      if (file.dir || path.startsWith('__MACOSX')) continue;

      const parts = path.split('/');
      if (parts.length < 2) continue;

      const layerName = parts[parts.length - 2];
      const fileName = parts[parts.length - 1];

      if (!fileName.match(/\.(png|svg|webp)$/i)) continue;

      const blob = await file.async('blob');
      const objectUrl = URL.createObjectURL(blob);
      const imageBitmap = await createImageBitmap(blob);

      if (!this.layers.has(layerName)) {
        this.layers.set(layerName, []);
      }

      this.layers.get(layerName).push({
        name: fileName.replace(/\.[^/.]+$/, ""),
        path: path,
        url: objectUrl,
        bitmap: imageBitmap,
        weight: 1.0 // Default equal weight
      });
    }

    // Set Layer Order
    const detected = Array.from(this.layers.keys());
    if (preferredOrder.length > 0) {
      this.layerOrder = preferredOrder.filter(l => this.layers.has(l));
      // Append any unmapped extra folders
      detected.forEach(l => {
        if (!this.layerOrder.includes(l)) this.layerOrder.push(l);
      });
    } else {
      this.layerOrder = detected;
    }

    return {
      layerCount: this.layers.size,
      layers: this.layers,
      order: this.layerOrder
    };
  }

  setLayerOrder(newOrder) {
    this.layerOrder = newOrder;
  }
}
