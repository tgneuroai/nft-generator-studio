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

      const fileName = parts[parts.length - 1];

      if (!fileName.match(/\.(png|svg|webp)$/i)) continue;

      // Determine layer/category name.
      // Case A: nested zip, e.g. "Background/Steel.svg" -> use parent folder name.
      // Case B: flat zip, e.g. "Hat43/Background_005_Steel.svg" (all assets dumped
      //         into a single top folder) -> derive category from filename prefix
      //         (text before the first underscore), since that's how these trait
      //         packs are usually named (Background_..., Skin_..., Eyes_..., etc).
      let layerName;
      if (parts.length >= 3) {
        layerName = parts[parts.length - 2];
      } else {
        const prefixMatch = fileName.match(/^([A-Za-z]+)_/);
        layerName = prefixMatch ? prefixMatch[1] : parts[parts.length - 2];
      }

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
