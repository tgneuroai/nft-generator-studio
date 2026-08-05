/**
 * Main Generation Orchestrator
 */
export class GeneratorEngine {
  constructor(layerManager) {
    this.layerManager = layerManager;
    this.existingSignatures = new Set();
    this.generatedNFTs = [];
    this.isGenerating = false;
    this.isPaused = false;
    this.collisionCount = 0;
  }

  /**
   * Populate initial hash set with existing collection trait combinations
   * @param {Array} originalSignatures - Unique string hashes representing existing 4,444 collection
   */
  loadExistingCollection(originalSignatures) {
    this.existingSignatures.clear();
    originalSignatures.forEach(sig => this.existingSignatures.add(sig));
  }

  /**
   * Generates a single candidate trait combination
   */
  generateCandidateTraits() {
    const traits = [];
    const signatureParts = [];

    for (const layerName of this.layerManager.layerOrder) {
      const traitList = this.layerManager.layers.get(layerName);
      if (!traitList || traitList.length === 0) continue;

      // Weighted selection algorithm
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
    let totalWeight = traits.reduce((acc, t) => acc + t.weight, 0);
    let random = Math.random() * totalWeight;

    for (const trait of traits) {
      if (random < trait.weight) return trait;
      random -= trait.weight;
    }
    return traits[0];
  }

  /**
   * Generates total target collection ensuring 0 duplicate collisions
   */
  async generateCollection(targetCount, onProgress, onComplete) {
    this.isGenerating = true;
    this.isPaused = false;
    let generated = 0;
    const startTime = performance.now();

    while (generated < targetCount && this.isGenerating) {
      if (this.isPaused) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      const candidate = this.generateCandidateTraits();

      // DUPLICATE PROTECTION: Check against original and generated signatures
      if (this.existingSignatures.has(candidate.signature)) {
        this.collisionCount++;
        continue; // Reject and generate another combination
      }

      // Accept NFT
      this.existingSignatures.add(candidate.signature);
      const tokenId = generated + 1;

      const nftData = {
        tokenId: tokenId,
        signature: candidate.signature,
        traits: candidate.traits,
        metadata: this.formatMetadata(tokenId, candidate.traits)
      };

      this.generatedNFTs.push(nftData);
      generated++;

      if (generated % 50 === 0 || generated === targetCount) {
        const elapsedSec = (performance.now() - startTime) / 1000;
        const speed = (generated / elapsedSec).toFixed(1);
        onProgress({
          current: generated,
          total: targetCount,
          collisions: this.collisionCount,
          speed: speed,
          latestNft: nftData
        });
        // Yield thread to UI render pass
        await new Promise(r => setTimeout(r, 0));
      }
    }

    this.isGenerating = false;
    if (onComplete) onComplete(this.generatedNFTs);
  }

  formatMetadata(tokenId, traits) {
    return {
      name: `Collection #${tokenId}`,
      description: "Official extension collection generated via Client-Side Generator Studio.",
      image: `ipfs://REPLACE_WITH_CID/${tokenId}.png`,
      attributes: traits.map(t => ({
        trait_type: t.layer,
        value: t.traitName
      }))
    };
  }

  pause() { this.isPaused = true; }
  resume() { this.isPaused = false; }
  stop() { this.isGenerating = false; }
}
