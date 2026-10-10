// The image database is supplied locally; builds never restore obsolete filenames.
import {readFile,access} from 'node:fs/promises'
const catalog=JSON.parse(await readFile(new URL('../src/services/exerciseImages.json',import.meta.url),'utf8'))
for(const name of [...Object.values(catalog.images).flat(),catalog.compound])await access(new URL('../public/exercises/'+encodeURIComponent(name),import.meta.url))
console.log('Verified renamed exercise images.')
