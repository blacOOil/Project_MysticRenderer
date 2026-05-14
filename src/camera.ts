import { mat4, vec3 } from 'gl-matrix';

export class OrbitCamera {
    yaw    = 0;
    pitch  = 0.3;
    radius = 3.0;

    private isDragging  = false;
    private lastX       = 0;
    private lastY       = 0;
    private lastTouchX  = 0;
    private lastTouchY  = 0;
    private lastPinchDist = 0;

    constructor(private canvas: HTMLCanvasElement) {
        this.registerEvents();
    }

    private registerEvents() {
        // Mouse
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
        });
        window.addEventListener('mouseup', () => {
            this.isDragging = false;
        });
        window.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.yaw   += dx * 0.005;
            this.pitch += dy * 0.005;
            this.clampPitch();
        });

        // Scroll zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            this.radius += e.deltaY * 0.01;
            this.clampRadius();
        }, { passive: false });

        // Touch orbit
        this.canvas.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
            }
            if (e.touches.length === 2) {
                this.lastPinchDist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
            }
        });
        this.canvas.addEventListener('touchmove', (e) => {
            e.preventDefault();
            if (e.touches.length === 1) {
                const dx = e.touches[0].clientX - this.lastTouchX;
                const dy = e.touches[0].clientY - this.lastTouchY;
                this.lastTouchX = e.touches[0].clientX;
                this.lastTouchY = e.touches[0].clientY;
                this.yaw   += dx * 0.005;
                this.pitch += dy * 0.005;
                this.clampPitch();
            }
            if (e.touches.length === 2) {
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY,
                );
                this.radius -= (dist - this.lastPinchDist) * 0.01;
                this.clampRadius();
                this.lastPinchDist = dist;
            }
        }, { passive: false });
    }

    private clampPitch() {
        this.pitch = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.pitch));
    }

    private clampRadius() {
        this.radius = Math.max(0.5, Math.min(20.0, this.radius));
    }

    getPosition(): [number, number, number] {
        return [
            this.radius * Math.sin(this.yaw) * Math.cos(this.pitch),
            this.radius * Math.sin(this.pitch),
            this.radius * Math.cos(this.yaw) * Math.cos(this.pitch),
        ];
    }

    getViewMatrix(): mat4 {
        const [x, y, z] = this.getPosition();
        return mat4.lookAt(
            mat4.create(),
            vec3.fromValues(x, y, z),
            vec3.fromValues(0, 0, 0),
            vec3.fromValues(0, 1, 0),
        );
    }
}