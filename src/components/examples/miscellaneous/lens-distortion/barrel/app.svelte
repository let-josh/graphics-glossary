<script
	module
	lang="ts"
>
	const dracoLoader = new DRACOLoader().setDecoderPath(
		"https://www.gstatic.com/draco/v1/decoders/",
	);
	const gltfLoader = new GLTFLoader();
	gltfLoader.setDRACOLoader(dracoLoader);
</script>

<script lang="ts">
	import gltfUrl from "@assets/gltfs/level-react-draco.glb";

	import { controls } from "@attachments/controls";
	import { pane } from "@attachments/pane";

	import PaneContainer from "@components/controls/PaneContainer.svelte";

	import { resize } from "@functions/resize";

	import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
	import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
	import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
	import {
		dot,
		pass,
		screenSize,
		sqrt,
		texture,
		uniform,
		uv,
		vec2,
		vec3,
		vertexStage,
	} from "three/tsl";
	import {
		Box3,
		MathUtils,
		PerspectiveCamera,
		RenderPipeline,
		Scene,
		Vector3,
		WebGPURenderer,
	} from "three/webgpu";

	const scene = new Scene();

	const axis = new Vector3(1, 1, 1).normalize();
	const camera = new PerspectiveCamera().translateOnAxis(axis, 3);
	const orbit = new OrbitControls(camera);

	gltfLoader.loadAsync(gltfUrl).then((gltf) => {
		scene.add(gltf.scene);
		new Box3().setFromObject(gltf.scene).getCenter(orbit.target);
		orbit.update();
	});

	const scenePass = pass(scene, camera);
	const output = scenePass.getTextureNode();

	const horizontalFOV = 90;
	const height = uniform(0);
	const strength = uniform(1);
	const cylindricalRatio = uniform(0.5);

	const scaledHeight = strength.mul(height);
	const aspectRatio = screenSize.x.div(screenSize.y);
	const cylAspectRatio = aspectRatio.mul(cylindricalRatio);
	const aspectDiagSq = aspectRatio.mul(aspectRatio).add(1);
	const diagSq = scaledHeight.mul(scaledHeight).mul(aspectDiagSq);
	const signedUV = uv().mul(2).add(vec2(-1, -1));

	const z = sqrt(diagSq.add(1)).mul(0.5).add(0.5);
	const ny = z.sub(1).div(cylAspectRatio.mul(cylAspectRatio).add(1));

	const vUVDot = sqrt(ny).mul(vec2(cylAspectRatio, 1)).mul(signedUV);

	const vUv = vertexStage(
		vec3(0.5, 0.5, 1.0)
			.mul(z)
			.add(vec3(-0.5, -0.5, 0))
			.add(vec3(uv(), 0)),
	);

	const _uv = dot(vUVDot, vUVDot)
		.mul(vec3(-0.5, -0.5, -1.0))
		.add(vUv);
</script>

<div class="relative">
	<PaneContainer
		class="absolute top-2 right-2"
		{@attach pane(
			{
				title: "post-processing uniforms",
			},
			(pane) => {
				pane.addBinding(strength, "value", {
					min: 0,
					max: 2,
					step: 0.1,
					label: "strength",
				});

				pane.addBinding(cylindricalRatio, "value", {
					min: 0,
					max: 4,
					step: 0.5,
					label: "cylindrical ratio",
				});
			},
		)}
	/>
	<canvas
		class="aspect-square"
		{@attach controls(orbit)}
		{@attach (canvas) => {
			const renderer = new WebGPURenderer({
				antialias: true,
				canvas,
			});

			const renderPipeline = new RenderPipeline(renderer);
			renderPipeline.outputNode = texture(output, _uv.div(_uv.z));

			const setAnimationLoopPromise = renderer.setAnimationLoop(() => {
				if (resize(renderer)) {
					const aspectRatio = canvas.clientWidth / canvas.clientHeight;

					height.value =
						Math.tan(MathUtils.degToRad(horizontalFOV) / 2) / aspectRatio;

					camera.fov = 2 * Math.atan(height.value) * MathUtils.RAD2DEG;
					camera.aspect = aspectRatio;
					camera.updateProjectionMatrix();
				}

				renderPipeline.render();
			});

			return () => {
				renderPipeline.dispose();
				setAnimationLoopPromise.then(() => {
					renderer.dispose();
				});
			};
		}}
	>
	</canvas>
</div>
