export interface MaterialData {
    diffuse:  [number, number, number];
    texture?: ImageBitmap;
}

export interface ModelData {
    vertices:  Float32Array;
    normals:   Float32Array;
    uvs?:      Float32Array;
    indices:   Uint16Array | Uint32Array;
    materials?: MaterialData[];
}

export const loadOBJ = (
    text:    string,
    mtlText?: string,    //  optional mtl
    bitmap?:  ImageBitmap //  optional texture image
): ModelData => {
    const finalVerts:   number[] = [];
    const finalNormals: number[] = [];
    const finalUVs:     number[] = [];
    const indices:      number[] = [];
    const tmpPos:       number[][] = [];
    const tmpNorm:      number[][] = [];
    const tmpUV:        number[][] = [];

    //  parse MTL for diffuse colors
    const materials: Map<string, MaterialData> = new Map();
    if (mtlText) {
        let currentMtlName = '';
        for (const line of mtlText.split('\n')) {
            const parts = line.trim().split(/\s+/);
            if (parts[0] === 'newmtl') {
                currentMtlName = parts[1];
                materials.set(currentMtlName, { diffuse: [0.8, 0.8, 0.8], texture: bitmap });
            } else if (parts[0] === 'Kd' && currentMtlName) {
                const mat = materials.get(currentMtlName)!;
                mat.diffuse = [parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])];
            } else if (parts[0] === 'map_Kd' && currentMtlName && bitmap) {
                //  assign bitmap to material that has a texture map
                materials.get(currentMtlName)!.texture = bitmap;
            }
        }
    }

    let currentMaterial: MaterialData = {
        diffuse: [0.8, 0.8, 0.8],
        texture: bitmap, // use bitmap directly if no mtl
    };
    const vertMaterials: MaterialData[] = [];

    for (const line of text.split('\n')) {
        const parts = line.trim().split(/\s+/);

        if (parts[0] === 'v') {
            tmpPos.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'vn') {
            tmpNorm.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
        } else if (parts[0] === 'vt') {
            tmpUV.push([parseFloat(parts[1]), 1.0 - parseFloat(parts[2])]); // ✅ flip V for WebGPU
        } else if (parts[0] === 'usemtl') {
            currentMaterial = materials.get(parts[1]) ?? currentMaterial;
        } else if (parts[0] === 'f') {
            const faceVerts = parts.slice(1).map(p => {
                const [vi, ti, ni] = p.split('/').map(Number);
                return { vi: vi - 1, ti: (ti || 1) - 1, ni: (ni || 1) - 1 };
            });
            for (let i = 1; i < faceVerts.length - 1; i++) {
                for (const fv of [faceVerts[0], faceVerts[i], faceVerts[i + 1]]) {
                    indices.push(finalVerts.length / 3);
                    finalVerts.push(...tmpPos[fv.vi]);
                    finalNormals.push(...(tmpNorm[fv.ni] ?? [0, 1, 0]));
                    finalUVs.push(...(tmpUV[fv.ti] ?? [0, 0]));
                    vertMaterials.push(currentMaterial);
                }
            }
        }
    }

    return {
        vertices:  new Float32Array(finalVerts),
        normals:   new Float32Array(finalNormals),
        uvs:       new Float32Array(finalUVs),
        indices:   new Uint32Array(indices),
        materials: vertMaterials,
    };
};