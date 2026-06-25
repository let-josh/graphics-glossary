<script module>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);

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

	const textureLoader = new t.TextureLoader();
</script>

<script lang="ts">
	import floorTextureUrl from "@assets/128x128/Misc/Synth-Misc_03-128x128.png";
	import hatchbackUrl from "@assets/gltfs/cars/hatchback.glb";
	import minivanUrl from "@assets/gltfs/cars/minivan.glb";
	import oldUrl from "@assets/gltfs/cars/old.glb";
	import saloonUrl from "@assets/gltfs/cars/saloon.glb";
	import sedanUrl from "@assets/gltfs/cars/sedan.glb";
	import stationWagonUrl from "@assets/gltfs/cars/station-wagon.glb";
	import stepvanUrl from "@assets/gltfs/cars/stepvan.glb";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as tsl from "three/tsl";
	import * as t from "three/webgpu";
	import { GLTFLoader } from "three/examples/jsm/Addons.js";
	import type { GLTF } from "three/examples/jsm/Addons.js";
	import { retroPass } from "three/examples/jsm/tsl/display/RetroPassNode.js";
	import { Pane } from "tweakpane";

	const radius = 10;
	const axis = new t.Vector3(1.5, 0.25, -1).normalize();
	const camera = new t.PerspectiveCamera(60, 1, 1, 50)
		.translateX(radius)
		.translateOnAxis(axis, 7.5);
	camera.lookAt(radius, 0, 0);

	const {
		promise: loadCars,
		resolve: resolveCars,
	}: PromiseWithResolvers<GLTF[]> = Promise.withResolvers();

	const {
		promise: loadFloorTexture,
		resolve: resolveFloorTexture,
	}: PromiseWithResolvers<t.Texture> = Promise.withResolvers();

	const light = new t.AmbientLight("white", 5);
	const scene = new t.Scene().add(light);
	const urls = [
		hatchbackUrl,
		minivanUrl,
		oldUrl,
		saloonUrl,
		sedanUrl,
		stationWagonUrl,
		stepvanUrl,
	] as const;

	$effect(() => {
		Promise.all(urls.map((url) => gltfLoader.loadAsync(url))).then(resolveCars);
		textureLoader.loadAsync(floorTextureUrl.src).then(resolveFloorTexture);
	});

	const group = new t.Group();
	scene.add(group);
	loadCars.then((cars) => {
		const a = (2 * Math.PI) / cars.length;
		let i = 0;
		for (const car of cars) {
			const angle = a * i;
			car.scene.position.x = radius * Math.cos(angle);
			car.scene.position.z = radius * Math.sin(angle);
			car.scene.lookAt(scene.position);
			car.scene.rotateY(Math.PI);
			group.add(car.scene);
			i += 1;
		}
	});

	const retro = tsl.uniform(true);

	const canvasSize = new Size();
	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	scene.fogNode = tsl.fog(
		tsl.color("#ffffff"),
		tsl.rangeFogFactor(camera.near, camera.far),
	);

	scene.backgroundNode = tsl.screenUV.y.mix(
		tsl.color("orange"),
		tsl.color("purple"),
	);

	loadFloorTexture.then((map) => {
		map.wrapS = map.wrapT = t.RepeatWrapping;

		const material = new t.MeshBasicMaterial({
			map,
		});
		const floor = new t.Mesh(new t.PlaneGeometry(), material).rotateX(
			-Math.PI / 2,
		);
		floor.scale.multiplyScalar(100);
		scene.add(floor);
	});

	const affineDistortion = tsl.uniform(1);
	const ditherEnabled = tsl.uniform(true);
	const bits = tsl.uniform(5);

	const rotate = { value: true };
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});

			pane.addBinding(rotate, "value", {
				label: "rotate",
			});

			pane
				.addBinding(retro, "value", {
					label: "retro",
				})
				.on("change", (e) => {
					uniformsFolder.disabled = !e.value;
				});

			const uniformsFolder = pane.addFolder({ title: "uniforms" });

			uniformsFolder.addBinding(affineDistortion, "value", {
				label: "affine",
				min: 0,
				max: 1,
				step: 0.1,
			});

			uniformsFolder.addBinding(ditherEnabled, "value", {
				label: "dither",
			});

			uniformsFolder.addBinding(bits, "value", {
				label: "bits per color channel",
				min: 2,
				max: 8,
				step: 1,
			});
		}}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
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

					const up = tsl.float(255);
					const down = up.div(tsl.float(2).pow(bits)).ceil();
					const posterized = color.rgb
						.mul(up)
						.add(tsl.select(ditherEnabled, dither(), tsl.float(0)))
						.clamp(0, up)
						.div(down)
						.floor()
						.div(up.div(down).floor());
					return tsl.vec4(posterized, color.a);
				})(),
				tsl.pass(scene, camera),
			);

			renderPipeline.outputNode = pipeline;
			const setAnimationLoop = renderer.setAnimationLoop(() => {
				if (rotate.value) group.rotateY(Math.PI / 900);
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
