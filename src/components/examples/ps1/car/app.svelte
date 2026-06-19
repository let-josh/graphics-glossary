<script module>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);

	const meshName = "Car2";

	const dither = tsl.Fn(() => {
		const uv = tsl.uvec2(tsl.screenCoordinate).mod(4);
		return tsl
			.array(
				[-4, 0, -3, 1, 2, -2, 3, -1, -3, 1, -4, 0, 3, -1, 2, -2].map((v) =>
					tsl.float(v),
				),
			)
			.element(uv.y.mul(4).add(uv.x));
	});
</script>

<script lang="ts">
	import carURL from "@assets/gltfs/car.glb";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import { DprSize } from "@classes/DprSize.svelte";
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

	const lightDirection = new t.Vector3(1, 1, 1).normalize();

	const scene = new t.Scene();
	getCarMesh.then((car) => {
		if (car === null) return car;

		const material:
			| (t.Material & {
					map?: t.Texture;
			  })
			| null = Array.isArray(car.material)
			? (car.material[0] ?? null)
			: car.material;
		// const material = materials[0] ?? null;

		if (material === null) return;

		const map = material.map ?? null;
		if (map === null) return;

		map.magFilter = map.minFilter = t.NearestFilter;
		map.generateMipmaps = false;
		car.material = new t.MeshBasicMaterial({
			map,
			vertexColors: true,
		});
		material.dispose();

		car.geometry.center();

		const normals = car.geometry.getAttribute("normal");
		const v = new t.Vector3();
		const colors: number[] = [];
		for (let i = 0; i < normals.count; i += 1) {
			v.fromBufferAttribute(normals, i);
			const dot = 0.5 * (1 + v.dot(lightDirection)); // -1 -> 1

			colors.push(dot, dot, dot);
		}
		const attribute = new t.Float32BufferAttribute(colors, 3);
		car.geometry.setAttribute("color", attribute);

		fitCameraToObject(camera, car);
		scene.add(car);
	});

	const arrow = new t.ArrowHelper(lightDirection);
	arrow.scale.multiplyScalar(5);
	scene.add(arrow);

	const retro = tsl.uniform(true);

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

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
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			const renderPipeline = new t.RenderPipeline(renderer);

			let pipeline = tsl.select(
				retro,
				tsl.Fn(() => {
					const color = retroPass(scene, camera, {
						affineDistortion,
					});

					const up = 255;
					const bits = 5;
					const down = Math.ceil(up / 2 ** bits);
					const posterized = color.rgb
						.mul(up)
						.add(dither())
						.clamp(0, up)
						.div(down)
						.floor()
						.div(Math.floor(up / down));
					return tsl.vec4(posterized, color.a);
				})(),
				tsl.pass(scene, camera),
			);

			// pipeline = tsl.posterize(pipeline, tsl.float(32));
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
