const _warn = console.warn.bind(console);
console.warn = (...args: any[]) => {
    if (typeof args[0] === 'string' && args[0].includes('Multiple instances of Three.js')) return;
    _warn(...args);
};

import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ModelData, MaterialData } from './objloader';

export const loadFBX = (buffer: ArrayBuffer): ModelData => {
    const loader = new FBXLoader();
    const object = loader.parse(buffer, '');

    const finalVerts:    number[] = [];
    const finalNormals:  number[] = [];
    const finalUVs:      number[] = []; // 
    const indices:       number[] = [];
    const vertMaterials: MaterialData[] = [];

    const box = new THREE.Box3().setFromObject(object);
    const size = new THREE.Vector3();
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const normalizeScale = maxDim > 0 ? 2.0 / maxDim : 1.0;

    const fixMatrix = new THREE.Matrix4()
        .makeRotationX(-Math.PI / 2)
        .scale(new THREE.Vector3(normalizeScale, normalizeScale, normalizeScale));

    object.traverse((child: any) => {
        if (child.type !== 'Mesh') return;

        let geo = (child.geometry as THREE.BufferGeometry).clone();
        if (!geo.attributes.position) return;
        if (!geo.attributes.normal) geo.computeVertexNormals();
        if (!geo.index) {
            try { geo = BufferGeometryUtils.mergeVertices(geo); }
            catch (e) { console.error('mergeVertices failed:', e); return; }
        }

        child.updateWorldMatrix(true, false);
        geo.applyMatrix4(child.matrixWorld);
        geo.applyMatrix4(fixMatrix);

        const pos  = geo.attributes.position;
        const norm = geo.attributes.normal;
        const uv   = geo.attributes.uv; // 
        const idx  = geo.index;
        if (!idx) return;

        // extract texture from material
        const mat = Array.isArray(child.material) ? child.material[0] : child.material;
        const diffuse: [number, number, number] = mat?.color
            ? [mat.color.r, mat.color.g, mat.color.b]
            : [0.6, 0.8, 1.0];

        //  extract texture image if present
        let texture: ImageBitmap | undefined;
        if (mat?.map?.image instanceof ImageBitmap) {
            texture = mat.map.image;
        }

        const vertOffset = finalVerts.length / 3;

        for (let i = 0; i < pos.count; i++) {
            finalVerts.push(pos.getX(i), pos.getY(i), pos.getZ(i));
            finalNormals.push(
                norm ? norm.getX(i) : 0,
                norm ? norm.getY(i) : 1,
                norm ? norm.getZ(i) : 0,
            );
            finalUVs.push(
                uv ? uv.getX(i) : 0, // 
                uv ? uv.getY(i) : 0,
            );
            vertMaterials.push({ diffuse, texture });
        }

        for (let i = 0; i < idx.count; i++) {
            indices.push(idx.getX(i) + vertOffset);
        }
    });

    return {
        vertices:  new Float32Array(finalVerts),
        normals:   new Float32Array(finalNormals),
        uvs:       new Float32Array(finalUVs), // 
        indices:   new Uint32Array(indices),
        materials: vertMaterials,
    };
};