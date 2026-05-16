// Registry for 3D models.
// Add your .glb or .gltf file paths here when you place them in the public folder.

export const ModelRegistry: Record<string, string[]> = {
  bed: [
    '/models/bed/model_1.glb',
    '/models/bed/model_2.glb',
    '/models/bed/model_3.glb',
    '/models/bed/model_4.glb',
  ],
  sofa: [
    '/models/sofa/model_1.glb',
    '/models/sofa/model_2.glb',
    '/models/sofa/model_3.glb',
    '/models/sofa/model_4.glb',
    '/models/sofa/model_5.glb',
    '/models/sofa/model_6.glb',
  ],
  lamp: [
    '/models/lamp/model_1.glb',
  ],
  toilet: [
    '/models/toilet/model_1.glb',
  ],
  bathtub: [
    '/models/bathtub/model_1.glb',
    '/models/bathtub/model_2.glb',
  ],
  washbasin: [
    '/models/washbasin/model_1.glb',
  ],
  door: [],
  window: []
};

// Map item types to their respective categories for the sidebar
export const ItemCategories = {
  build: ['door', 'window'],
  furniture: ['bed', 'sofa'],
  bathroom: ['bathtub', 'toilet', 'washbasin'],
  lighting: ['lamp'],
};
