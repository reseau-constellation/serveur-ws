import { build } from 'esbuild'

/**
 * We publish the "pnpm" package bundled with all refclone artifacts for macOS and Windows.
 * Unfortunately, we need to do this because otherwise corepack wouldn't be able to install
 * pnpm with reflink support. Reflink is only unpacking the pnpm tarball and does no additional actions.
 */
;(async () => {
  try {
    await build({
      entryPoints: ['dist/src/constl.js'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      splitting: false,
      outfile: 'dist-bin/constl',
      external: ['node-gyp'],
      define: {
        'process.env.npm_package_name': JSON.stringify(
          process.env.npm_package_name
        ),
        'process.env.npm_package_version': JSON.stringify(
          process.env.npm_package_version
        ),
      },
      loader: {
        '.node': 'copy',
      },
    })
  } catch (err) {
    console.error(err)
    process.exit(1)
  }
})()