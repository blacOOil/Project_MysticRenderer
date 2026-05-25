import { CheckWebGPU, InitGPUForCanvas, CreateGPUBuffer } from './helper';
import { loadOBJ } from './objloader';
import { loadFBX } from './fbxloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const CANVAS_COUNT = 1; //  change this to add more viewports

const main = async () => {
    if (!navigator.gpu) {
        alert('WebGPU not supported in this browser.');
        return;
    }

    const emptyModel = {
        vertices:  new Float32Array([0, 0, 0]),
        normals:   new Float32Array([0, 1, 0]),
        indices:   new Uint32Array([0]),
        materials: [],
        uvs:       new Float32Array([0, 0]),
    };

    //  create a renderer for each canvas
    const renderers: Renderer[] = [];
    const cameras:   OrbitCamera[] = [];

    for (let i = 0; i < CANVAS_COUNT; i++) {
        const canvas = document.getElementById(`canvas-${i}`) as HTMLCanvasElement;
        if (!canvas) continue;

        try {
            const { device, format, context } = await InitGPUForCanvas(canvas);
            const camera   = new OrbitCamera(canvas);
            const renderer = new Renderer(device, canvas, context, format, camera, emptyModel);
            renderer.start();
            renderers.push(renderer);
            cameras.push(camera);
        } catch (e) {
            console.error(`Failed to init canvas-${i}:`, e);
        }
    }

    //  track which viewport is active (for file drops / browse)
    let activeIndex = 0;
    document.querySelectorAll('.viewport').forEach((vp, i) => {
        vp.addEventListener('click', () => {
            document.querySelectorAll('.viewport').forEach(v => v.classList.remove('active'));
            vp.classList.add('active');
            activeIndex = i;
        });
    });
    // set first viewport active by default
    document.querySelectorAll('.viewport')[0]?.classList.add('active');

    //  load file into active viewport
    let pendingFiles: Map<string, File> = new Map();

    const loadFile = async (file: File) => {
        const ext = file.name.split('.').pop()?.toLowerCase();
        const renderer = renderers[activeIndex];
        const camera   = cameras[activeIndex];
        if (!renderer) return;

        try {
            if (ext === 'fbx') {
                const buffer = await file.arrayBuffer();
                renderer.loadModel(loadFBX(buffer));
                renderer.setRotation(0, 0, 0);
                camera.radius = 3.0;
                camera.yaw = 0;
                camera.pitch = 0.3;

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
        }
    };

    const tryLoadOBJWithAssets = async (files: Map<string, File>, renderer: Renderer) => {
        const objFile = files.get('obj');
        if (!objFile) return;

        const objText = await objFile.text();
        const mtlFile = files.get('mtl');
        const texFile = files.get('tex');

        const mtlText = mtlFile ? await mtlFile.text() : undefined;
        const bitmap  = texFile ? await createImageBitmap(texFile) : undefined;

        renderer.loadModel(loadOBJ(objText, mtlText, bitmap));
        renderer.setRotation(0, 0, 0);
    };

    //  drag and drop on each canvas individually
    document.querySelectorAll('.viewport canvas').forEach((c, i) => {
        const canvas = c as HTMLCanvasElement;
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            canvas.classList.add('drag-over');
            activeIndex = i; // auto-select viewport on drag
        });
        canvas.addEventListener('dragleave', () => canvas.classList.remove('drag-over'));
        canvas.addEventListener('drop', async (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            activeIndex = i;
            pendingFiles.clear();
            const files = Array.from((e as DragEvent).dataTransfer?.files ?? []);
            for (const file of files) await loadFile(file);
        });
    });

    // ---- Browse button — loads into active viewport ----
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const browseBtn = document.getElementById('browse-btn') as HTMLButtonElement;

    browseBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', async () => {
        pendingFiles.clear();
        const files = Array.from(fileInput.files ?? []);
        for (const file of files) await loadFile(file);
        fileInput.value = '';
    });

    // ---- Light controls — apply to active viewport ----
    const ambientSlider = document.getElementById('ambient') as HTMLInputElement;
    const lightXSlider  = document.getElementById('lightX')  as HTMLInputElement;
    const lightYSlider  = document.getElementById('lightY')  as HTMLInputElement;
    const lightZSlider  = document.getElementById('lightZ')  as HTMLInputElement;
    const bgPicker      = document.getElementById('bg-color') as HTMLInputElement;

    const updateLight = () => {
        const r = renderers[activeIndex];
        if (!r) return;
        r.setAmbient(parseFloat(ambientSlider.value));
        r.setLightDirection(
            parseFloat(lightXSlider.value),
            parseFloat(lightYSlider.value),
            parseFloat(lightZSlider.value),
        );
    };

    ambientSlider.addEventListener('input', updateLight);
    lightXSlider.addEventListener('input',  updateLight);
    lightYSlider.addEventListener('input',  updateLight);
    lightZSlider.addEventListener('input',  updateLight);

    bgPicker.addEventListener('input', () => {
        const hex = bgPicker.value;
        const r   = parseInt(hex.slice(1, 3), 16) / 255;
        const g   = parseInt(hex.slice(3, 5), 16) / 255;
        const b   = parseInt(hex.slice(5, 7), 16) / 255;
        renderers[activeIndex]?.setBackgroundColor(r, g, b);
    });

    // ---- Resize handler ----
    window.addEventListener('resize', () => {
        document.querySelectorAll('.viewport').forEach((vp, i) => {
            const canvas = vp.querySelector('canvas') as HTMLCanvasElement;
            if (canvas) {
                canvas.width  = vp.clientWidth;
                canvas.height = vp.clientHeight;
            }
        });
    });
};

main();