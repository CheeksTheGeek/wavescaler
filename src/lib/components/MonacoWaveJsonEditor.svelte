<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { createEventDispatcher } from 'svelte';
	import { browser } from '$app/environment';
	import { themeStore } from '$lib/theme-store';
	import type { WaveJson } from '$lib/wavejson-types';
	import { generateWaveJsonString } from '$lib/wavejson-generator';
	import { parseWaveJson } from '$lib/wavejson-parser';

	export let waveJson: WaveJson;
	export let visible: boolean = false;

	const dispatch = createEventDispatcher<{
		change: { waveJson: WaveJson };
		error: { message: string };
		close: {};
	}>();

	let editorElement: HTMLDivElement;
	let editor: any;
	let model: any;
	let monaco: any;
	let isUpdatingFromProp = false;
	let isUpdatingFromEditor = false;

	// Resize functionality
	let editorWidth = 400; // Default width
	let isResizing = false;
	let resizeStartX = 0;
	let resizeStartWidth = 0;

	// Load saved width from localStorage on mount
	if (typeof window !== 'undefined') {
		const savedWidth = localStorage.getItem('wavescaler-editor-width');
		if (savedWidth) {
			editorWidth = parseInt(savedWidth, 10);
		}
	}

	// Define custom Monaco themes that match Wavescaler's theme
	const wavescalerLightTheme = {
		base: 'vs',
		inherit: true,
		rules: [
			{ token: 'string.key.json', foreground: '3b82f6', fontStyle: 'bold' },  // accent-primary for keys
			{ token: 'string.value.json', foreground: 'ff17e8' },  // success color for string values
			{ token: 'number.json', foreground: 'f59e0b' },  // warning color for numbers
			{ token: 'keyword.json', foreground: 'ef4444' },  // error color for keywords (null, true, false)
			{ token: 'delimiter.bracket.json', foreground: '475569' },  // text-secondary for brackets
			{ token: 'delimiter.array.json', foreground: '475569' },  // text-secondary for array delimiters
			{ token: 'delimiter.comma.json', foreground: '475569' }  // text-secondary for commas
		],
		colors: {
			'editor.background': '#ffffff',  // bg-primary
			'editor.foreground': '#0f172a',  // text-primary
			'editorLineNumber.foreground': '#64748b',  // text-tertiary
			'editorLineNumber.activeForeground': '#475569',  // text-secondary
			'editor.lineHighlightBackground': '#f1f5f9',  // bg-tertiary with transparency
			'editor.selectionBackground': '#ff9717',  // accent-primary with transparency
			'editorCursor.foreground': '#3b82f6',  // accent-primary
			'editorWhitespace.foreground': '#94a3b833',  // text-placeholder with transparency
			'editorIndentGuide.background': '#e2e8f0',  // border-primary
			'editorIndentGuide.activeBackground': '#cbd5e1',  // border-secondary
			'editorBracketMatch.background': '#3b82f61a',  // accent-light
			'editorBracketMatch.border': '#3b82f6'  // accent-primary
		}
	};

	const wavescalerDarkTheme = {
		base: 'vs-dark',
		inherit: true,
		rules: [
			{ token: 'string.key.json', foreground: '6366f1', fontStyle: 'bold' },  // accent-primary for keys
			{ token: 'string.value.json', foreground: '22c0c5' },  // success color for string values
			{ token: 'number.json', foreground: 'eab308' },  // warning color for numbers
			{ token: 'keyword.json', foreground: 'f87171' },  // error color for keywords
			{ token: 'delimiter.bracket.json', foreground: 'cbd5e1' },  // text-secondary for brackets
			{ token: 'delimiter.array.json', foreground: 'cbd5e1' },  // text-secondary for array delimiters
			{ token: 'delimiter.comma.json', foreground: 'cbd5e1' }  // text-secondary for commas
		],
		colors: {
			'editor.background': '#16161d',  // bg-primary
			'editor.foreground': '#f1f5f9',  // text-primary
			'editorLineNumber.foreground': '#94a3b8',  // text-tertiary
			'editorLineNumber.activeForeground': '#cbd5e1',  // text-secondary
			'editor.lineHighlightBackground': '#ff9717',  // bg-tertiary with transparency
			'editor.selectionBackground': '#ff9717',  // accent-primary with transparency
			'editorCursor.foreground': '#6366f1',  // accent-primary
			'editorWhitespace.foreground': '#64748b33',  // text-placeholder with transparency
			'editorIndentGuide.background': '#2d2d3a',  // border-primary
			'editorIndentGuide.activeBackground': '#3d3d4a',  // border-secondary
			'editorBracketMatch.background': '#6366f11a',  // accent-light
			'editorBracketMatch.border': '#6366f1'  // accent-primary
		}
	};

	// Monaco setup
	onMount(() => {
		if (!browser) return;

		let unsubscribeTheme: (() => void) | undefined;

		// Load Monaco asynchronously
		const loadMonaco = async () => {
			// Dynamic imports for client-side only
			const [
				monacoModule,
				editorWorkerModule,
				jsonWorkerModule
			] = await Promise.all([
				import('monaco-editor'),
				import('monaco-editor/esm/vs/editor/editor.worker?worker'),
				import('monaco-editor/esm/vs/language/json/json.worker?worker')
			]);

			monaco = monacoModule;
			const editorWorker = editorWorkerModule.default;
			const jsonWorker = jsonWorkerModule.default;

			// Setup Monaco environment
			(self as any).MonacoEnvironment = {
				getWorker: function (_: any, label: string) {
					if (label === 'json') {
						return new jsonWorker();
					}
					return new editorWorker();
				}
			};

			// Define custom themes
			monaco.editor.defineTheme('wavescaler-light', wavescalerLightTheme);
			monaco.editor.defineTheme('wavescaler-dark', wavescalerDarkTheme);

			// Create editor with theme-aware configuration
			const effectiveTheme = $themeStore === 'auto' 
				? themeStore.getEffectiveTheme($themeStore)
				: $themeStore;

			editor = monaco.editor.create(editorElement, {
				language: 'json',
				theme: effectiveTheme === 'dark' ? 'wavescaler-dark' : 'wavescaler-light',
				automaticLayout: true,
				fontSize: 14,
				lineNumbers: 'on',
				minimap: { enabled: false },
				scrollBeyondLastLine: false,
				wordWrap: 'on',
				folding: true,
				tabSize: 2,
				insertSpaces: true,
				formatOnPaste: true,
				formatOnType: true,
				fixedOverflowWidgets: true,
				overflowWidgetsDomNode: editorElement,
				roundedSelection: true,
				smoothScrolling: true,
				contextmenu: false,
				scrollbar: {
					useShadows: false,
					verticalHasArrows: false,
					horizontalHasArrows: false,
					vertical: 'visible',
					horizontal: 'visible',
					verticalScrollbarSize: 10,
					horizontalScrollbarSize: 10,
					arrowSize: 0
				},
				bracketPairColorization: { enabled: true },
				guides: {
					bracketPairs: true,
					indentation: true
				},
				suggest: {
					showKeywords: true,
					showSnippets: true
				}
			});

			// Additional editor styling after creation
			const editorDomNode = editor.getDomNode();
			if (editorDomNode) {
				editorDomNode.style.borderRadius = '0 0 var(--radius-lg) 0';
			}

			// Set initial content
			updateEditorContent();

			// Listen for content changes
			model = editor.getModel()!;
			model.onDidChangeContent(() => {
				if (!isUpdatingFromProp) {
					handleEditorChange();
				}
			});

			// Listen for theme changes
			unsubscribeTheme = themeStore.subscribe((theme) => {
				if (editor && monaco) {
					const effectiveTheme = theme === 'auto' 
						? themeStore.getEffectiveTheme(theme)
						: theme;
					monaco.editor.setTheme(effectiveTheme === 'dark' ? 'wavescaler-dark' : 'wavescaler-light');
				}
			});
		};

		loadMonaco().catch(console.error);

		// Cleanup theme subscription on destroy
		return () => {
			if (unsubscribeTheme) {
				unsubscribeTheme();
			}
		};
	});

	// Update editor content when waveJson prop changes
	$: if (browser && editor && monaco && waveJson && !isUpdatingFromEditor) {
		updateEditorContent();
	}

	function updateEditorContent() {
		if (!browser || !editor || !monaco || isUpdatingFromEditor) return;
		
		isUpdatingFromProp = true;
		const result = generateWaveJsonString(waveJson, true);
		
		if (result.success && result.jsonString) {
			const currentValue = editor.getValue();
			if (currentValue !== result.jsonString) {
				editor.setValue(result.jsonString);
			}
		}
		
		// Reset flag after a short delay to allow for editor updates
		setTimeout(() => {
			isUpdatingFromProp = false;
		}, 10);
	}

	function handleEditorChange() {
		if (isUpdatingFromProp || !monaco || !editor) return;
		
		isUpdatingFromEditor = true;
		const content = editor.getValue();
		
		// Try to parse the content
		const parseResult = parseWaveJson(content);
		
		if (parseResult.success && parseResult.data) {
			// Clear any error markers
			monaco.editor.setModelMarkers(model, 'wavejson-parser', []);
			dispatch('change', { waveJson: parseResult.data });
		} else {
			// Show error in editor
			const lines = content.split('\n');
			monaco.editor.setModelMarkers(model, 'wavejson-parser', [{
				severity: monaco.MarkerSeverity.Error,
				message: parseResult.error || 'Invalid WaveJSON',
				startLineNumber: 1,
				startColumn: 1,
				endLineNumber: lines.length,
				endColumn: lines[lines.length - 1].length + 1
			}]);
			
			dispatch('error', { message: parseResult.error || 'Invalid WaveJSON' });
		}
		
		// Reset flag after a short delay
		setTimeout(() => {
			isUpdatingFromEditor = false;
		}, 10);
	}

	// Format the JSON content
	function formatJson() {
		if (browser && editor && monaco) {
			editor.getAction('editor.action.formatDocument')?.run();
		}
	}

	// Resize handlers
	function handleResizeStart(event: MouseEvent) {
		isResizing = true;
		resizeStartX = event.clientX;
		resizeStartWidth = editorWidth;
		
		// Prevent text selection during resize
		document.body.style.userSelect = 'none';
		document.body.style.cursor = 'col-resize';
		
		// Add global mouse listeners
		document.addEventListener('mousemove', handleResizeMove);
		document.addEventListener('mouseup', handleResizeEnd);
	}

	function handleResizeMove(event: MouseEvent) {
		if (!isResizing) return;
		
		const deltaX = event.clientX - resizeStartX;
		const newWidth = Math.max(250, Math.min(window.innerWidth * 0.8, resizeStartWidth - deltaX)); // Allow resizing up to 80% of window width
		editorWidth = newWidth;
	}

	function handleResizeEnd() {
		if (!isResizing) return;
		
		isResizing = false;
		
		// Restore normal cursor and text selection
		document.body.style.userSelect = '';
		document.body.style.cursor = '';
		
		// Remove global listeners
		document.removeEventListener('mousemove', handleResizeMove);
		document.removeEventListener('mouseup', handleResizeEnd);
		
		// Save to localStorage
		if (typeof window !== 'undefined') {
			localStorage.setItem('wavescaler-editor-width', editorWidth.toString());
		}
	}

	// Double-click functionality
	function getCenteredWidth(): number {
		return Math.floor(window.innerWidth * 0.45); // 45% of window width
	}

	function isCentered(): boolean {
		const centered = getCenteredWidth();
		return Math.abs(editorWidth - centered) < 20; // Within 20px tolerance
	}

	function handleResizeDoubleClick(event: MouseEvent) {
		event.preventDefault();
		
		// Cmd/Meta + double-click = close directly
		if (event.metaKey || event.ctrlKey) {
			dispatch('close', {});
			return;
		}
		
		// Regular double-click behavior
		if (isCentered()) {
			// Already centered, close the editor
			dispatch('close', {});
		} else {
			// Not centered, center it
			editorWidth = getCenteredWidth();
			
			// Save the new width
			if (typeof window !== 'undefined') {
				localStorage.setItem('wavescaler-editor-width', editorWidth.toString());
			}
		}
	}

	onDestroy(() => {
		if (browser) {
			// Clean up resize listeners in case component is destroyed during resize
			if (isResizing) {
				document.removeEventListener('mousemove', handleResizeMove);
				document.removeEventListener('mouseup', handleResizeEnd);
				document.body.style.userSelect = '';
				document.body.style.cursor = '';
			}
			
			if (model) {
				model.dispose();
			}
			if (editor) {
				editor.dispose();
			}
		}
	});
</script>

<div class="monaco-container" class:visible style="width: {editorWidth}px">
	<!-- Resize Handle -->
	<div 
		class="resize-handle"
		class:resizing={isResizing}
		on:mousedown={handleResizeStart}
		on:dblclick={handleResizeDoubleClick}
		role="separator"
		aria-label="Resize editor panel"
		title="Drag to resize • Double-click to center/close • Cmd+double-click to close"
	></div>
	
	<div class="monaco-header">
		<h3>WaveJSON Editor</h3>
		<button class="format-button" on:click={formatJson} title="Format JSON (Shift+Alt+F)">
			<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
				<path d="M4 4h8v1H4zM4 6h6v1H4zM4 8h8v1H4zM4 10h5v1H4z"/>
			</svg>
			Format
		</button>
	</div>
	<div class="monaco-editor-wrapper">
		<div class="monaco-editor-inner" bind:this={editorElement}></div>
	</div>
</div>

<style>
	.monaco-container {
		display: none;
		flex-direction: column;
		height: calc(100% - 2rem);
		background-color: var(--color-bg-elevated);
		border-left: 1px solid var(--color-border-primary);
		overflow: hidden;
		border-radius: 0 var(--radius-lg) var(--radius-lg) 0;
		position: relative;
		flex-shrink: 0;
		margin-top: 1rem;
		margin-bottom: 1rem;
		margin-right: 1rem;
	}

	.monaco-container.visible {
		display: flex;
	}

	.monaco-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px 16px;
		background-color: var(--color-bg-secondary);
		border-bottom: 1px solid var(--color-border-primary);
		border-radius: 0 var(--radius-lg) 0 0;
		z-index: 1;
	}

	.monaco-header h3 {
		margin: 0;
		font-size: 14px;
		font-weight: 600;
		color: var(--color-text-primary);
	}

	.format-button {
		display: flex;
		align-items: center;
		gap: 6px;
		padding: 6px 12px;
		border: 1px solid var(--color-border-primary);
		border-radius: var(--radius-sm);
		background-color: var(--color-bg-primary);
		color: var(--color-text-primary);
		font-size: 12px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.format-button:hover {
		background-color: var(--color-bg-tertiary);
		border-color: var(--color-border-hover);
	}

	.format-button:active {
		transform: translateY(1px);
	}

	.monaco-editor-wrapper {
		flex: 1;
		position: relative;
		overflow: hidden;
		border-radius: 0 0 var(--radius-lg) 0;
		z-index: 0;
	}

	.monaco-editor-inner {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		border-radius: 0 0 var(--radius-lg) 0;
	}

	/* Ensure Monaco editor respects container's border radius */
	:global(.monaco-editor) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	:global(.monaco-editor .overflow-guard) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	:global(.monaco-editor .monaco-scrollable-element) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	:global(.monaco-editor .monaco-scrollable-element > .scrollbar) {
		border-radius: var(--radius-lg) !important;
	}

	:global(.monaco-editor .monaco-scrollable-element > .scrollbar > .slider) {
		border-radius: var(--radius-sm) !important;
		margin: 2px !important;
	}

	/* Ensure content doesn't overflow the rounded corners */
	:global(.monaco-editor .view-overlays),
	:global(.monaco-editor .view-lines),
	:global(.monaco-editor .decorationsOverviewRuler),
	:global(.monaco-editor .scrollbar.vertical),
	:global(.monaco-editor .scrollbar.horizontal) {
		border-radius: 0 0 var(--radius-lg) 0 !important;
		overflow: hidden !important;
	}

	/* Custom resize handle */
	.resize-handle {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 4px;
		background-color: transparent;
		cursor: col-resize;
		z-index: 100;
		transition: background-color 0.15s ease;
	}

	.resize-handle:hover {
		background-color: var(--color-accent-light);
	}

	.resize-handle.resizing {
		background-color: var(--color-accent-medium);
	}

	/* Add a subtle visual indicator */
	.resize-handle::after {
		content: '';
		position: absolute;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 1px;
		height: 20px;
		background-color: var(--color-border-secondary);
		opacity: 0;
		transition: opacity 0.15s ease, background-color 0.2s ease;
	}

	.resize-handle:hover::after {
		opacity: 1;
	}

	.resize-handle.resizing::after {
		opacity: 1;
		background-color: var(--color-accent-primary);
	}
</style> 
