import { ContractAnalyzer } from './contractAnalyzer.js';
import { LayerManager } from './layerManager.js';
import { GeneratorEngine } from './generatorEngine.js';
import { UIManager } from './uiManager.js';

class NFTStudioApp {
  constructor() {
    this.analyzer = new ContractAnalyzer();
    this.layerManager = new LayerManager();
    this.engine = new GeneratorEngine(this.layerManager);
    this.ui = new UIManager(this.layerManager);

    this.initEventListeners();
  }

  initEventListeners() {
    // Contract File Upload
    document.getElementById('file-contract').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      this.ui.logConsole(`Loading contract ZIP: ${file.name}`);
      try {
        const zip = await JSZip.loadAsync(file);
        const analysis = await this.analyzer.analyzeSolidityFiles(zip.files);

        document.getElementById('contract-analysis-results').innerHTML = `
          <p><strong>Detected Layers:</strong> ${analysis.layerOrder.length}</p>
          <p><strong>Trait Mappings:</strong> ${Object.keys(analysis.traitMappings).length} mapped</p>
        `;
        this.ui.logConsole("Contract analysis complete.");
      } catch (err) {
        this.ui.logConsole(`Error reading contract ZIP: ${err.message}`);
      }
    });

    // Layer ZIP Upload
    document.getElementById('file-layers').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      this.ui.logConsole(`Extracting assets from layer archive: ${file.name}`);
      try {
        const zip = await JSZip.loadAsync(file);
        
        // Pass zip.files properly to LayerManager
        const { order, layerCount } = await this.layerManager.processLayerZip(
          zip.files, 
          this.analyzer.detectedOrder
        );

        if (layerCount === 0) {
          this.ui.logConsole("Error: No valid images found inside ZIP folders!");
          alert("ZIP ফাইলের ভেতর কোনো ফোল্ডার বা ইমেজ পাওয়া যায়নি। দয়া করে ফোল্ডারসহ জিপ আপলোড করুন।");
          return;
        }

        this.ui.updateLayerTreeUI(order, (newOrder) => {
          this.layerManager.setLayerOrder(newOrder);
          this.ui.updateLayerTreeUI(newOrder, () => {});
        });

        this.ui.logConsole(`Layers imported successfully (${layerCount} layers).`);
        this.triggerRandomPreview();
      } catch (err) {
        this.ui.logConsole(`Error extracting layers: ${err.message}`);
      }
    });

    // Preview Randomize Button
    document.getElementById('btn-randomize').addEventListener('click', () => {
      this.triggerRandomPreview();
    });

    // Start Generation Action
    document.getElementById('btn-start-gen').addEventListener('click', () => {
      const targetCount = parseInt(document.getElementById('gen-count').value, 10);
      
      if (this.layerManager.layerOrder.length === 0) {
        alert("দয়া করে প্রথমে লেয়ার ZIP আপলোড করুন!");
        return;
      }

      this.ui.logConsole(`Starting collection generation: Target = ${targetCount} NFTs`);
      document.getElementById('btn-start-gen').disabled = true;

      this.engine.generateCollection(
        targetCount,
        (progress) => {
          // Progress updates
          document.getElementById('stat-status').textContent = "Generating...";
          document.getElementById('stat-progress').textContent = `${progress.current} / ${progress.total}`;
          document.getElementById('stat-collisions').textContent = progress.collisions;
          document.getElementById('stat-speed').textContent = `${progress.speed} NFT/s`;
          
          const pct = (progress.current / progress.total) * 100;
          document.getElementById('generation-progress-bar').style.width = `${pct}%`;

          // Live Preview current batch item
          if (progress.latestNft && progress.latestNft.traits) {
            this.ui.renderPreview(progress.latestNft.traits);
            this.ui.updateMetadataPreview(progress.latestNft.metadata);
          }
        },
        (completedNFTs) => {
          // Completion
          document.getElementById('stat-status').textContent = "Complete";
          if (completedNFTs.length < targetCount) {
            this.ui.logConsole(`Generated ${completedNFTs.length} unique NFTs (requested ${targetCount}). Your imported layers only support ${completedNFTs.length} unique combinations - add more trait variations per category to reach a higher count.`);
          } else {
            this.ui.logConsole(`Successfully generated ${completedNFTs.length} unique NFTs.`);
          }
          document.getElementById('btn-export-zip').disabled = false;
          document.getElementById('btn-start-gen').disabled = false;
        }
      );
    });

    // Export ZIP Package
    document.getElementById('btn-export-zip').addEventListener('click', async () => {
      this.exportCollectionZIP();
    });
  }

  triggerRandomPreview() {
    if (this.layerManager.layerOrder.length === 0) return;
    const candidate = this.engine.generateCandidateTraits();
    this.ui.renderPreview(candidate.traits);
    this.ui.updateMetadataPreview(this.engine.formatMetadata(1, candidate.traits));
  }

  async exportCollectionZIP() {
    this.ui.logConsole("Preparing ZIP package for export...");
    const exportZip = new JSZip();
    const metadataFolder = exportZip.folder("metadata");
    
    this.engine.generatedNFTs.forEach(nft => {
      metadataFolder.file(`${nft.tokenId}.json`, JSON.stringify(nft.metadata, null, 2));
    });

    // Generate CSV Report
    let csvContent = "Token ID,Signature\n";
    this.engine.generatedNFTs.forEach(nft => {
      csvContent += `${nft.tokenId},"${nft.signature}"\n`;
    });
    exportZip.file("report/generation_report.csv", csvContent);

    const blob = await exportZip.generateAsync({ type: "blob" });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = "nft_collection_export.zip";
    link.click();
    
    this.ui.logConsole("Export complete! ZIP download started.");
  }
}

// Bootstrap Application
window.addEventListener('DOMContentLoaded', () => {
  new NFTStudioApp();
});
