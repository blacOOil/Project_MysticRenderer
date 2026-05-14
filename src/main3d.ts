import { InitGPU } from './helper';
import { loadOBJ } from './objloader';
import { OrbitCamera } from './camera';
import { Renderer } from './renderer';
import './site.css';

const main = async () => {
    const { device, canvas, format, context } = await InitGPU();
    const camera = new OrbitCamera(canvas);

    // ✅ list all models here
    const modelPaths = [
        './model.obj',
        './model0.obj',
    ];
    let currentIndex = 0;

    // load first model
    const firstModel = await loadOBJ(modelPaths[currentIndex]);
    const renderer   = new Renderer(device, canvas, context, format, camera, firstModel);
    renderer.start();

    // button logic
    const prevBtn = document.getElementById('Previous_model') as HTMLButtonElement;
    const nextBtn = document.getElementById('Next_model')     as HTMLButtonElement;

    const swapModel = async (index: number) => {
        prevBtn.disabled = true;
        nextBtn.disabled = true;

        const objData = await loadOBJ(modelPaths[index]);
        renderer.loadModel(objData);

        prevBtn.disabled = false;
        nextBtn.disabled = false;
    };

    prevBtn.addEventListener('click', async () => {
        currentIndex = (currentIndex - 1 + modelPaths.length) % modelPaths.length;
        await swapModel(currentIndex);
    });

    nextBtn.addEventListener('click', async () => {
        currentIndex = (currentIndex + 1) % modelPaths.length;
        await swapModel(currentIndex);
    });
};

main();