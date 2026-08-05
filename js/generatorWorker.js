/**
 * generatorWorker.js
 * Background Web Worker for multi-threaded NFT combinations and duplication checks.
 */

// Worker-wide state tracking
let existingSignatures = new Set();
let layerOrder = [];
let layersMap = new Map();

self.onmessage = async function (e) {
  const { action, payload } = e.data;

  switch (action) {
    case 'INIT':
      // Initialize configuration and layer data sent from main thread
      layerOrder = payload.layerOrder;
      layersMap = new Map(payload.layers);
      existingSignatures = new Set(payload.existingSignatures || []);
      
      self.postMessage({ type: 'STATUS', message: 'Worker Initialized Successfully' });
      break;

    case 'START_GENERATION':
      const { targetCount } = payload;
      let generated = 0;
      let collisionCount = 0;
      const startTime = performance.now();

      while (generated < targetCount) {
        const candidate = generateCandidateTraits();

        // Check for duplicates across historical and current generation sets
        if (existingSignatures.has(candidate.signature)) {
          collisionCount++;
          continue; // Duplicate found, discard and retry
        }

        // Unique combination approved
        existingSignatures.add(candidate.signature);
        generated++;

        const tokenId = generated;
        const nftData = {
          tokenId: tokenId,
          signature: candidate.signature,
          traits: candidate.traits
        };

        // Batch report progress every 20 items or upon completion
        if (generated % 20 === 0 || generated === targetCount) {
          const elapsedSec = (performance.now() - startTime) / 1000;
          const speed = (generated / elapsedSec).toFixed(1);

          self.postMessage({
            type: 'PROGRESS',
            payload: {
              current: generated,
              total: targetCount,
              collisions: collisionCount,
              speed: speed,
              latestNft: nftData
            }
          });
        }
      }

      // Complete generation batch
      self.postMessage({
        type: 'COMPLETE',
        payload: {
          totalGenerated: generated,
          collisions: collisionCount
        }
      });
      break;

    case 'CLEAR':
      existingSignatures.clear();
      layerOrder = [];
      layersMap.clear();
      break;
  }
};

/**
 * Weighted random selection algorithm for picking traits
 */
function weightedRandomSelect(traits) {
  let totalWeight = 0;
  for (let i = 0; i < traits.length; i++) {
    totalWeight += traits[i].weight || 1.0;
  }

  let random = Math.random() * totalWeight;

  for (let i = 0; i < traits.length; i++) {
    const weight = traits[i].weight || 1.0;
    if (random < weight) {
      return traits[i];
    }
    random -= weight;
  }

  return traits[0];
}

/**
 * Generates a candidate combination of traits based on configured layers
 */
function generateCandidateTraits() {
  const traits = [];
  const signatureParts = [];

  for (const layerName of layerOrder) {
    const traitList = layersMap.get(layerName);
    if (!traitList || traitList.length === 0) continue;

    const selected = weightedRandomSelect(traitList);
    
    traits.push({
      layer: layerName,
      traitName: selected.name,
      path: selected.path
    });

    signatureParts.push(`${layerName}:${selected.name}`);
  }

  return {
    traits: traits,
    signature: signatureParts.join('|')
  };
}
