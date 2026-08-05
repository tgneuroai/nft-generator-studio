/**
 * js/generatorEngine.js
 * Generator Engine using Web Worker for high performance background rendering
 */
export class GeneratorEngine {
  constructor(layerManager) {
    this.layerManager = layerManager;
    this.existingSignatures = new Set();
    this.generatedNFTs = [];
    this.isGenerating = false;
    this.isPaused = false;
    this.collisionCount = 0;
    this.worker = null;
  }

  loadExistingCollection(originalSignatures) {
    this.existingSignatures.clear();
    originalSignatures.forEach(sig => this.existingSignatures.add(sig));
  }

  generateCandidateTraits() {
    const traits = [];
    const signatureParts = [];

    for (const layerName of this.layerManager.layerOrder) {
      const traitList = this.layerManager.layers.get(layerName);
      if (!traitList || traitList.length === 0) continue;

      const selected = this.weightedRandomSelect(traitList);
      traits.push({
        layer: layerName,
        traitName: selected.name,
        asset: selected
      });

      signatureParts.push(`${layerName}:${selected.name}`);
    }

    const signature = signatureParts.join('|');
    return { traits, signature };
  }

  weightedRandomSelect(traits) {
    let totalWeight = traits.reduce((acc, t) => acc + (t.weight || 1.0), 0);
    let random = Math.random() * totalWeight;

    for (const trait of traits) {
      if (random < (trait.weight || 1.0)) return trait;
      random -= (trait.weight || 1.0);
    }
    return traits[0];
  }

  /**
   * Generates total target collection via Web Worker
   */
  async generateCollection(targetCount, onProgress, onComplete) {
    if (this.layerManager.layerOrder.length === 0) {
      alert("No layers imported! Please upload layers first.");
      return;
    }

    this.isGenerating = true;
    this.generatedNFTs = [];

    // Initialize Web Worker
    if (this.worker) this.worker.terminate();
    this.worker = new Worker('js/generatorWorker.js');

    // Convert Map to Array for Web Worker serialization
    const layersArray = Array.from(this.layerManager.layers.entries()).map(([key, val]) => [
      key,
      val.map(item => ({ name: item.name, weight: item.weight, path: item.path }))
    ]);

    // Send init message to worker
    this.worker.postMessage({
      action: 'INIT',
      payload: {
        layerOrder: this.layerManager.layerOrder,
        layers: layersArray,
        existingSignatures: Array.from(this.existingSignatures)
      }
    });

    // Start process in worker
    this.worker.postMessage({
      action: 'START_GENERATION',
      payload: { targetCount }
    });

    // Handle messages from Worker
    this.worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'PROGRESS') {
        // Find full trait assets to render preview in UI
        const hydratedTraits = payload.latestNft.traits.map(t => {
          const layerTraits = this.layerManager.layers.get(t.layer) || [];
          const asset = layerTraits.find(x => x.name === t.traitName);
          return { ...t, asset };
        });

        const nftData = {
          tokenId: payload.latestNft.tokenId,
          signature: payload.latestNft.signature,
          traits: hydratedTraits,
          metadata: this.formatMetadata(payload.latestNft.tokenId, hydratedTraits)
        };

        this.generatedNFTs.push(nftData);

        onProgress({
          current: payload.current,
          total: payload.total,
          collisions: payload.collisions,
          speed: payload.speed,
          latestNft: nftData
        });
      } 
      else if (type === 'COMPLETE') {
        this.isGenerating = false;
        this.worker.terminate();
        if (onComplete) onComplete(this.generatedNFTs);
      }
    };
  }

  formatMetadata(tokenId, traits) {
    return {
      name: `Collection #${tokenId}`,
      description: "Generated via Client-Side NFT Studio Pro.",
      image: `ipfs://REPLACE_WITH_CID/${tokenId}.png`,
      attributes: traits.map(t => ({
        trait_type: t.layer,
        value: t.traitName
      }))
    };
  }

  stop() {
    if (this.worker) this.worker.terminate();
    this.isGenerating = false;
  }
}
