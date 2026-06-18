<script module>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);

	const meshName = "Car2";
</script>

<script lang="ts">
	import carURL from "@assets/gltfs/car.glb";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { isMesh } from "@functions/isMesh";
	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as tsl from "three/tsl";
	import * as t from "three/webgpu";
	import { GLTFLoader, OrbitControls } from "three/examples/jsm/Addons.js";
	import type { GLTF } from "three/examples/jsm/Addons.js";
	import { retroPass } from "three/examples/jsm/tsl/display/RetroPassNode.js";

	const camera = new t.PerspectiveCamera();
	const orbit = new OrbitControls(camera);
	orbit.autoRotate = true;

	const {
		promise: loadCarGLTF,
		resolve: resolveCarPromise,
	}: PromiseWithResolvers<GLTF> = Promise.withResolvers();

	$effect(() => {
		gltfLoader.loadAsync(carURL).then(resolveCarPromise);

		const size = 256;
		const oss = new OffscreenCanvas(size, size);
		const context = oss.getContext("2d");
		if (context === null) throw new Error("context is null");

		const halfSize = size / 2;

		const gradient = context.createRadialGradient(
			halfSize,
			halfSize,
			0,
			halfSize,
			halfSize,
			Math.hypot(halfSize, halfSize),
		);

		gradient.addColorStop(0, "orange");
		gradient.addColorStop(1, "purple");

		context.fillStyle = gradient;
		context.fillRect(0, 0, size, size);

		const map = new t.CanvasTexture(oss);
		map.minFilter = map.magFilter = t.NearestFilter;
		map.generateMipmaps = false;
		const lastBackground = scene.background;
		scene.background = map;
		return () => {
			scene.background = lastBackground;
			map.dispose();
		};
	});

	const getCarMesh = loadCarGLTF.then((o) => {
		const mesh = o.scene.getObjectByName(meshName);
		if (isMesh(mesh)) return mesh;
		return null;
	});

	const scene = new t.Scene();
	getCarMesh.then((car) => {
		if (car === null) return car;

		const materials: (t.Material & {
			map?: t.Texture;
		})[] = Array.isArray(car.material) ? car.material : [car.material];
		const material = materials[0] ?? null;

		if (material === null) return;

		const map = material.map ?? null;
		if (map === null) return;

		map.magFilter = map.minFilter = t.NearestFilter;
		map.generateMipmaps = false;
		car.material = new t.MeshBasicMaterial({
			map,
		});
		material.dispose();

		car.geometry.center();
		fitCameraToObject(camera, car);
		scene.add(car);
	});

	const retro = tsl.uniform(true);

	const canvasSize = new Size();
	const rendererSize = RendererSize.fromSize(canvasSize);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const affineDistortion = tsl.uniform(1);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "controls",
			},
			(pane) => {
				pane.addBinding(orbit, "autoRotate", {
					label: "auto rotate",
				});

				const uniformsFolder = pane.addFolder({
					title: "uniforms",
				});

				uniformsFolder
					.addBinding(retro, "value", {
						label: "retro",
					})
					.on("change", (e) => {
						affineBinding.disabled = !e.value;
					});

				const affineBinding = uniformsFolder.addBinding(
					affineDistortion,
					"value",
					{
						label: "affine",
						min: 0,
						max: 1,
						step: 0.1,
					},
				);
			},
		)}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		class="aspect-square md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				canvas,
			});

			$effect(() => {
				setRendererSize(renderer, rendererSize);
			});

			const renderPipeline = new t.RenderPipeline(renderer);

			let pipeline = tsl.select(
				retro,
				retroPass(scene, camera, {
					affineDistortion,
				}),
				tsl.pass(scene, camera),
			);

			pipeline = tsl.posterize(pipeline, tsl.float(32));
			renderPipeline.outputNode = pipeline;
			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (orbit.autoRotate) orbit.update();
				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
