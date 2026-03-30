import { optimize } from 'svgo';

export function optimizeSvg(svgString: string): string {
  const result = optimize(svgString, {
    multipass: true,
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            cleanupIds: false, // Preserve room IDs
            removeViewBox: false, // Keep viewBox
          },
        },
      },
      'removeComments',
      'removeMetadata',
      'mergePaths',
      {
        name: 'convertColors',
        params: {
          currentColor: false,
          names2hex: true,
          rgb2hex: true,
        },
      },
      {
        name: 'cleanupNumericValues',
        params: {
          floatPrecision: 3,
        },
      },
      'minifyStyles',
      'removeUnusedNS',
      // Remove fixed width/height from root svg
      {
        name: 'removeDimensions',
      },
    ],
  });

  return result.data;
}
