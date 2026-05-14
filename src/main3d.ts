import { InitGPU } from './helper';
import { loadOBJ } from './objloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const camera = new OrbitCamera(canvas);

    const firstModel = loadOBJ(await fetch('./model.obj').then(r => r.text()));
    const renderer   = new Renderer(device, canvas, context, format, camera, firstModel);
    renderer.start();

    // ---- shared load helper ----
    const loadFromText = (text: string) => {
        renderer.loadModel(loadOBJ(text));
    };

    // ---- Browse button ----
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('browse-btn') as HTMLButtonElement;

    browseBtn.addEventListener('click', () => {
        fileInput.click(); //  trigger hidden file picker
    });

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        if (!file.name.endsWith('.obj')) {
            alert('Only .obj files are supported.');
            return;
        }
        loadFromText(await file.text());
        fileInput.value = ''; //  reset so same file can be re-picked
    });

    // ---- Drag and drop ----
    const dropZone = canvas;

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', async (e) => {
        e.preventDefault();
        dropZone.classList.remove('drag-over');
        const file = e.dataTransfer?.files[0];
        if (!file) return;
        if (!file.name.endsWith('.obj')) {
            alert('Only .obj files are supported.');
            return;
        }
        loadFromText(await file.text());
    });
};

main();