<script
	module
	lang="ts"
>
	const gltfLoader = new GLTFLoader();
	setDRACOLoader(gltfLoader);
	const meshName = "Avocado";
</script>

<script lang="ts">
	import { controls } from "@attachments/controls";

	import { DprSize } from "@classes/DprSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { fitCameraToObject } from "@functions/fitCameraToObject";
	import { isMesh } from "@functions/isMesh";
	import { loadAvocado } from "@functions/loadAvocado";
	import { setCameraAspect } from "@functions/setCameraAspect";
	import { setDRACOLoader } from "@functions/setDRACOLoader";

	import * as t from "three/webgpu";
	import { GLTFLoader, OrbitControls } from "three/addons";
	import type { GLTF } from "three/addons";
	import { Pane } from "tweakpane";

	const canvasSize = new Size();

	const camera = new t.PerspectiveCamera(60, 1, 0.01, 1);

	const orbit = new OrbitControls(camera);

	const rendererSize = new DprSize(
		() => canvasSize.width,
		() => canvasSize.height,
	);

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const { promise: loadGltf, resolve } = Promise.withResolvers<GLTF>();

	$effect(() => {
		loadAvocado(gltfLoader).then(resolve);
	});

	const light = new t.AmbientLight();
	const box = new t.Box3();
	const helper = new t.Box3Helper(box);
	const scene = new t.Scene().add(light, helper);

	loadGltf.then((gltf) => {
		scene.add(gltf.scene);
	});

	loadGltf.then((gltf) => {
		const box = new t.Box3();
		const size = new t.Vector3();
		fitCameraToObject(camera, gltf.scene, {
			box,
			size,
		});
		const min = Math.min(...size);
		sprite.scale.setScalar(min / 25);
		box.getCenter(orbit.target);
	});

	const getMesh = loadGltf.then((gltf) => {
		const object = gltf.scene.getObjectByName(meshName);
		if (isMesh(object)) {
			object.rotateY(Math.PI);
			return object;
		}

		return null;
	});

	const getMaterial = getMesh.then((mesh) => {
		if (mesh === null) return mesh;
		const material = Array.isArray(mesh.material)
			? mesh.material[0]
			: mesh.material;
		return material ?? null;
	});

	const getGeometry = getMesh.then((mesh) => {
		if (mesh === null) return mesh;
		return mesh.geometry;
	});

	const createPoints = getGeometry.then((geometry) => {
		if (geometry === null) return null;
		return new t.Points(geometry);
	});

	createPoints.then((points) => {
		if (points === null) return;
		scene.add(points);
	});

	const getPositionAttribute = getGeometry.then((geometry) => {
		if (geometry === null) return geometry;
		return geometry.getAttribute("position");
	});

	const sprite = new t.Sprite();
	scene.add(sprite);

	const intervalMs = {
		value: 50,
	};
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach (container) => {
			const pane = new Pane({
				container,
				title: "controls",
			});

			pane.addBinding(intervalMs, "value", {
				label: "speed (ms)",
				min: 0,
				max: 500,
				step: 1,
			});

			const addPointsBindings = createPoints.then((points) => {
				if (points === null) return;
				pane.addBinding(points, "visible", {
					label: "points visible",
				});
			});

			const addMaterialBindings = getMaterial.then((material) => {
				if (material === null) return;
				material.transparent = true;
				material.opacity = 0.2;
				pane.addBinding(material, "opacity", {
					label: "opacity",
					min: 0,
					max: 1,
					step: 0.1,
				});

				if (
					"wireframe" in material &&
					typeof material.wireframe === "boolean"
				) {
					pane.addBinding(material, "wireframe", {
						label: "wireframe",
					});
				}
			});

			return () => {
				Promise.all([addPointsBindings, addMaterialBindings]).then(() => {
					pane.dispose();
				});
			};
		}}
	/>
	<canvas
		bind:clientWidth={canvasSize.width}
		bind:clientHeight={canvasSize.height}
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new t.WebGPURenderer({
				antialias: true,
				canvas,
			});

			$effect(() => {
				renderer.setSize(rendererSize.width, rendererSize.height, false);
			});

			let index = 0;
			let lastTime = 0;
			let accumulatedTime = 0;

			const setAnimationLoop = getPositionAttribute.then((position) => {
				if (position === null) return;
				renderer.setAnimationLoop((time) => {
					const diff = time - lastTime;
					accumulatedTime += diff;
					if (accumulatedTime >= intervalMs.value) {
						if (index <= position.count) {
							sprite.position.fromBufferAttribute(position, index);
							box.expandByPoint(sprite.position);
						} else {
							index = 0;
							box.makeEmpty();
						}
						accumulatedTime = 0;
						index += 1;
					}

					renderer.render(scene, camera);
					lastTime = time;
				});
			});

			return () => {
				setAnimationLoop.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
