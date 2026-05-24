import { InitGPU } from './helper';
import { loadOBJ } from './objloader';
import { loadFBX } from './fbxloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const camera = new OrbitCamera(canvas);

    let firstModel;
    try {
        const text = await fetch('./model.obj').then(r => {
            if (!r.ok) throw new Error(`HTTP ${r.status}`);
            return r.text();
        });
        firstModel = loadOBJ(text);
    } catch (e) {
        console.warn('No default model.obj found:', e);
        firstModel = {
            vertices:  new Float32Array([0, 0, 0]),
            normals:   new Float32Array([0, 1, 0]),
            indices:   new Uint32Array([0]),
            materials: [],
            uvs:       new Float32Array([0, 0]),
        };
    }

    const renderer = new Renderer(device, canvas, context, format, camera, firstModel);
    renderer.start();

    // store pending files — user may drop obj+mtl+texture together
    let pendingFiles: Map<string, File> = new Map();

    const loadFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        try {
            if (ext === 'fbx') {
                const buffer = await file.arrayBuffer();
                renderer.loadModel(loadFBX(buffer));
                renderer.setRotation(0, 0, 0);
                camera.radius = 3.0;
                camera.yaw    = 0;
                camera.pitch  = 0.3;

            } else if (ext === 'obj') {
                pendingFiles.set('obj', file);
                await tryLoadOBJWithAssets(pendingFiles, renderer);

            } else if (ext === 'mtl') {
                pendingFiles.set('mtl', file);
                await tryLoadOBJWithAssets(pendingFiles, renderer);

            } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext ?? '')) {
                pendingFiles.set('tex', file);
                await tryLoadOBJWithAssets(pendingFiles, renderer);

            } else {
                alert('Supported: .obj .mtl .png .jpg .fbx');
            }
        } catch (e) {
            console.error('Failed to load:', e);
            alert('Failed to load model.');
        }
    };

    //  try to load OBJ once we have the files we need
    const tryLoadOBJWithAssets = async (files: Map<string, File>, renderer: Renderer) => {
        const objFile = files.get('obj');
        if (!objFile) return; // wait for obj at minimum

        const objText   = await objFile.text();
        const mtlFile   = files.get('mtl');
        const texFile   = files.get('tex');

        let mtlText: string | undefined;
        if (mtlFile) mtlText = await mtlFile.text();

        let bitmap: ImageBitmap | undefined;
        if (texFile) bitmap = await createImageBitmap(texFile);

        const modelData = loadOBJ(objText, mtlText, bitmap);
        renderer.loadModel(modelData);
        renderer.setRotation(0, 0, 0);
    };
    const ambientSlider = document.getElementById('ambient') as HTMLInputElement;
    const lightXSlider  = document.getElementById('lightX')  as HTMLInputElement;
    const lightYSlider  = document.getElementById('lightY')  as HTMLInputElement;
    const lightZSlider  = document.getElementById('lightZ')  as HTMLInputElement;

    const updateLight = () => {
    renderer.setAmbient(parseFloat(ambientSlider.value));
    renderer.setLightDirection(
        parseFloat(lightXSlider.value),
        parseFloat(lightYSlider.value),
        parseFloat(lightZSlider.value),
    );
};
    const bgPicker = document.getElementById('bg-color') as HTMLInputElement;
    bgPicker.addEventListener('input', () => {
    const hex = bgPicker.value;
    const r = parseInt(hex.slice(1,3), 16) / 255;
    const g = parseInt(hex.slice(3,5), 16) / 255;
    const b = parseInt(hex.slice(5,7), 16) / 255;
    renderer.setBackgroundColor(r, g, b);
});

    ambientSlider.addEventListener('input', updateLight);
    lightXSlider.addEventListener('input',  updateLight);
    lightYSlider.addEventListener('input',  updateLight);
    lightZSlider.addEventListener('input',  updateLight);

    // ---- Browse button ----
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('browse-btn') as HTMLButtonElement;

    browseBtn.addEventListener('click', () => fileInput.click());

    fileInput.addEventListener('change', async () => {
        //  allow selecting multiple files at once
        const files = Array.from(fileInput.files ?? []);
        pendingFiles.clear(); // reset on new browse
        for (const file of files) await loadFile(file);
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
        const files = Array.from(e.dataTransfer?.files ?? []);
        pendingFiles.clear(); // reset on new drop
        for (const file of files) await loadFile(file);
    });
};

main();