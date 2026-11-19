import { registerSW } from 'virtual:pwa-register';
import { elapsedSeconds } from './timer';

registerSW({ immediate: true });
document.querySelector<HTMLDivElement>('#app')!.textContent = `Cyphose (${elapsedSeconds(Date.now(), Date.now())} s)`;
