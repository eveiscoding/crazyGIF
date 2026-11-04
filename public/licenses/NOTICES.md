# Third-party licenses and corresponding source

The repository's own application code is provided under the MIT license in LICENSE, copyright (c) 2026 eveiscoding. The existing notice is retained.

The application includes **@imgly/background-removal 1.7.0**, © IMG.LY GmbH, licensed under GNU Affero General Public License v3. A combined distribution containing this dependency must comply with the AGPL, including the applicable complete corresponding source and notice obligations. Lazy loading does not remove these obligations. Do not describe the complete bundled distribution as MIT-only.

- Application source, modifications, build scripts and lockfile: <https://github.com/eveiscoding/crazyGIF>. The deployed footer links to the exact deployment commit when built by Actions.
- IMG.LY source: <https://github.com/imgly/background-removal-js>; exact published package source/build metadata: <https://registry.npmjs.org/@imgly/background-removal/-/background-removal-1.7.0.tgz>.
- Full AGPL text is included in `public/licenses/AGPL-3.0.txt` and available in each built distribution under `licenses/AGPL-3.0.txt`.
- Model and runtime assets are downloaded on demand from IMG.LY's static distribution. They run locally; the app does not send input images with these requests.

Other dependencies include React / React DOM (MIT), gifenc (MIT), ONNX Runtime Web (MIT), lodash-es (MIT), ndarray (MIT), zod (MIT), and the ISNET model (MIT according to IMG.LY's ThirdPartyLicenses.json). Full installed production dependency license texts and IMG.LY's third-party manifest are copied into `public/licenses/` by `scripts/licenses.mjs` before build. This also includes transitive production dependencies where a license file is shipped. See `package-lock.json` for exact versions. Vite, TypeScript and test tools are build/development dependencies.

For a closed-source distribution, obtain an appropriate commercial license from IMG.LY or replace the AGPL component before distribution. No commercial license is implied by this repository.
