// 정적 웹 자산을 Capacitor가 사용할 www/ 디렉터리로 복사한다.
// 소스는 그대로 리포 루트에 두어 GitHub Pages 배포와 공유한다.
import { rmSync, mkdirSync, cpSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const www = resolve(root, 'www');

// Capacitor가 www에 주입하는 런타임을 보존하기 위해 매번 정리 후 복사
rmSync(www, { recursive: true, force: true });
mkdirSync(www, { recursive: true });

const files = ['index.html', 'manifest.json', 'privacy.html'];
const dirs = ['css', 'js', 'assets', 'icons'];

for (const f of files) {
  cpSync(resolve(root, f), resolve(www, f));
}
for (const d of dirs) {
  cpSync(resolve(root, d), resolve(www, d), { recursive: true });
}

console.log('✓ www/ 빌드 완료');
