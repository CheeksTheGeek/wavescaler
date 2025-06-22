<script lang="ts">
	import WaveformDiagram from '$lib/components/WaveformDiagram.svelte';
	import type { WaveJson } from '$lib/wavejson-types';

	// Sample WaveJSON data for demonstration
	const sampleWaveform: WaveJson = {
		signal: [
			{ name: 'clk', wave: 'p.......' },
			{ name: 'bus', wave: 'x.==.=x.', data: ['head', 'body', 'tail', 'data'] },
			{ name: 'wire', wave: '0.1..0.1' },
			{},
			['CPU', 
				{ name: 'UPC', wave: '01.0....' },
				{ name: 'IPC', wave: '0...1..0' },
				{ name: 'PPC', wave: '0..10..1' }
			],
			{},
			{ name: 'reset', wave: '1.0.....' }
		],
		config: { hscale: 1 }
	};
</script>

<div class="container">
	<h1>Wavescaler - Waveform Diagram Editor</h1>
	<p>Interactive waveform diagram editor built with SvelteKit</p>
	
	<div class="waveform-container">
		<WaveformDiagram waveJson={sampleWaveform} />
	</div>
</div>

<style>
	.container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	h1 {
		color: #333;
		margin-bottom: 0.5rem;
	}

	p {
		color: #666;
		margin-bottom: 2rem;
	}

	.waveform-container {
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 1rem;
		background: white;
		box-shadow: 0 2px 4px rgba(0,0,0,0.1);
	}
</style>
