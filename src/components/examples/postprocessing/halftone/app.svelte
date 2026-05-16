<script
	lang="ts"
	module
>
	import gltfUrl from "@assets/gltfs/IridescenceAbalone.glb";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	const gltfLoader = new GLTFLoader();
</script>

<script lang="ts">
	import { resize } from "@functions/resize";
	import { setCameraAspect } from "@functions/setCameraAspect";

	import {
		GLTFLoader,
		OrbitControls,
		RoomEnvironment,
	} from "three/examples/jsm/Addons.js";
	import {
		Discard,
		Fn,
		If,
		bool,
		length,
		pass,
		screenSize,
		select,
		step,
		texture,
		uniform,
		uv,
		vec2,
	} from "three/tsl";
	import {
		PMREMGenerator,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		TextureNode,
		WebGPURenderer,
	} from "three/webgpu";
	import type { Node } from "three/webgpu";

	const scene = new Scene();
	const camera = new PerspectiveCamera().translateZ(0.25);

	const scenePass = pass(scene, camera);
	const tex = scenePass.getTextureNode();

	gltfLoader.loadAsync(gltfUrl).then((gltf) => {
		scene.add(gltf.scene);
	});

	const environment = new RoomEnvironment();

	const orbit = new OrbitControls(camera);

	const radius = uniform(0.5);
	const size = uniform(16);
	const enabled = uniform(true);

	type FloatOrNumber = Node<"float"> | number;

	const halftone = Fn(
		([tex, { radius = 0.5, size = 16 } = {}]: [
			tex: TextureNode,
			options?: Partial<{ radius: FloatOrNumber; size: FloatOrNumber }>,
		]) => {
			const n = vec2(size, size).div(screenSize);

			const zeroOrOne = uv().y.div(n.y).floor().mod(2);
			const offset = vec2(n.x.mul(0.5).mul(zeroOrOne), 0);

			const offsetUv = uv().add(offset);

			const cellUv = offsetUv.div(n).fract();
			const dist = length(cellUv.sub(0.5));
			const circle = step(radius, dist);

			If(bool(circle), () => {
				Discard();
			});

			const UV = offsetUv.div(n).floor().mul(n);

			return texture(tex, UV);
		},
	);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane({ title: "uniforms" }, (pane) => {
			pane.addBinding(size, "value", {
				label: "size",
				options: {
					"4": 4,
					"8": 8,
					"16": 16,
					"32": 32,
				},
			});

			pane.addBinding(radius, "value", {
				label: "radius",
				min: 0,
				max: 0.5,
				step: 0.1,
			});

			pane.addBinding(enabled, "value", {
				label: "enabled",
			});
		})}
	/>
	<canvas
		class="aspect-square md:md:aspect-video"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = select(
				enabled,
				halftone(tex, {
					radius,
					size,
				}),
				texture(tex),
			);

			const pmremGenerator = new PMREMGenerator(renderer);

			const promise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspect = canvas.clientWidth / canvas.clientHeight;
					setCameraAspect(camera, aspect);
				}

				renderPipeline.render();
			});

			promise.then(() => {
				const envMap = pmremGenerator.fromScene(environment).texture;
				scene.environment = envMap;
			});

			return () => {
				renderPipeline.dispose();
				promise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
