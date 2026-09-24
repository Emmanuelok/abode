import imageIndex from './navigation-images.json';

type NavigationImage = {image: string; count: number};
const departmentImages: Record<string, NavigationImage> = imageIndex.departments;
const collectionImages: Record<string, NavigationImage> = imageIndex.collections;

export const departmentImage = (slug: string) => departmentImages[slug];
export const collectionImage = (department: string, collection: string) => collectionImages[`${department}/${collection}`];
