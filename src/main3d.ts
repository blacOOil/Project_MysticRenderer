import { InitGPU } from './helper';
import { loadOBJ } from './objloader';
import { loadFBX } from './fbxloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const camera = new OrbitCamera(canvas);

    //  safe default model load with fallback
    let firstModel;
    try {
        const text = await fetch('./model.obj').then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        });
        firstModel = loadOBJ(text);
    } catch (e) {
        console.warn('No default model.obj found, starting empty:', e);
        //  empty model so renderer doesn't crash
        firstModel = {
            vertices: new Float32Array([0, 0, 0]),
            normals:  new Float32Array([0, 1, 0]),
            indices:  new Uint32Array([0]),
            materials: [],
        };
    }

    const renderer = new Renderer(device, canvas, context, format, camera, firstModel);
    renderer.start();

    // ---- shared file loader ----
    const loadFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        try {
            if (ext === 'obj') {
                const text = await file.text();
                renderer.loadModel(loadOBJ(text));
                renderer.setRotation(0, 0, 0); 
            } else if (ext === 'fbx') {
                const buffer = await file.arrayBuffer();
                renderer.loadModel(loadFBX(buffer));
                renderer.setRotation( 0, 0, 0);
            } else {
                alert('Only .obj and .fbx files are supported.');
            }
        } catch (e) {
            console.error('Failed to load model:', e);
            alert('Failed to load model. Check console for details.');
        }
    };

    // ---- Browse button ----
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('browse-btn') as HTMLButtonElement;

    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        const file = fileInput.files?.[0];
        if (!file) return;
        await loadFile(file);
        fileInput.value = '';
    });

    // ---- Drag and drop ----
    canvas.addEventListener('dragover', (e) => {
        e.preventDefault();
        canvas.classList.add('drag-over');
    });

    canvas.addEventListener('dragleave', () => {
        canvas.classList.remove('drag-over');
    });

    canvas.addEventListener('drop', async (e) => {
        e.preventDefault();
        canvas.classList.remove('drag-over');
        const file = e.dataTransfer?.files[0];
        if (!file) return;
        await loadFile(file);
    });
};

main();