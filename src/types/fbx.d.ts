declare module 'three/examples/jsm/loaders/FBXLoader.js' {
    import { Loader, Group } from 'three';
    export class FBXLoader extends Loader {
        parse(buffer: ArrayBuffer, path: string): Group;
    }
}