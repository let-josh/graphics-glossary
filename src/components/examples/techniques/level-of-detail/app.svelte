<script
	lang="ts"
	module
>
	const speed = 1 / 1000;

	const maxDistance = 15;
	const minDistance = 3;
	const halfway = 0.5 * (maxDistance + minDistance);

	const distances = [maxDistance, halfway, minDistance];

	const radius = 1;

	const cameraPositionZStart = 2 + maxDistance;
</script>

<script lang="ts">
	import { RendererSize, setRendererSize } from "@classes/RendererSize.svelte";
	import { Size } from "@classes/Size.svelte";

	import { onCleanup } from "@functions/onCleanup.svelte";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import * as t from "three/webgpu";
	import { lerp } from "three/src/math/MathUtils.js";

	const lod = new t.LOD();

	const geometries: t.BufferGeometry[] = [];

	const material = new t.MeshNormalMaterial({
		flatShading: true,
	});

	for (let i = 0, l = distances.length; i < l; i += 1) {
		const geometry = new t.IcosahedronGeometry(radius, i);

		geometries.push(geometry);
		const object = new t.Mesh(geometry, material);

		const distance = distances[i];

		lod.addLevel(object, distance);
	}

	onCleanup(() => {
		for (const distance of distances) lod.removeLevel(distance);
		for (const geometry of geometries) geometry.dispose();
		material.dispose();
	});

	const cameraPositionZEnd = 2 + lod.position.z + radius;

	const camera = new t.PerspectiveCamera();

	const canvasSize = new Size();

	$effect(() => {
		setCameraAspect(camera, canvasSize.ratio);
	});

	const rendererSize = RendererSize.fromSize(canvasSize);
</script>

<canvas
	bind:clientWidth={canvasSize.width}
	bind:clientHeight={canvasSize.height}
	{@attach (canvas) => {
		const renderer = new t.WebGPURenderer({
			antialias: true,
			canvas,
		});

		$effect(() => {
			setRendererSize(renderer, rendererSize);
		});

		const setAnimationLoop = renderer.setAnimationLoop((time) => {
			time = 0.5 * (1 + Math.sin(time * speed));
			camera.position.z = lerp(cameraPositionZStart, cameraPositionZEnd, time);

			renderer.render(lod, camera);
		});

		return () => {
			setAnimationLoop.then(() => {
				renderer.dispose();
			});
		};
	}}
>
</canvas>
