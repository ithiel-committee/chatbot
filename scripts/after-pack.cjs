const fs = require('fs')
const path = require('path')

exports.default = async function (context) {
  console.log('📦 afterPack hook triggered!')
  const destDir = path.join(
    context.appOutDir,
    'resources',
    'standalone',
    'node_modules'
  )
  const srcDir = path.join(
    context.packager.projectDir,
    '.next',
    'standalone',
    'node_modules'
  )

  if (fs.existsSync(srcDir)) {
    console.log(`📦 Copying ${srcDir} -> ${destDir} ...`)
    fs.cpSync(srcDir, destDir, { recursive: true, dereference: true })
    console.log('✅ standalone node_modules successfully bundled into app package!')
  } else {
    console.warn(`⚠️ Warning: ${srcDir} does not exist. Standalone server may fail.`)
  }
}
