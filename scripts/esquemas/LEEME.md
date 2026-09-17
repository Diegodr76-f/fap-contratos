# Esquemas OOXML — ISO/IEC 29500-4:2016

Copia del esquema oficial de Office Open XML, la parte de transición (que es la
que Word escribe de verdad). Está aquí para que `scripts/validar_docx.py` pueda
comprobar los `.docx` sin depender de nada instalado en la máquina.

No se editan. Si hiciera falta actualizarlos, se reemplaza la carpeta entera por
la publicación correspondiente de ISO/IEC 29500-4.

Por qué están: en septiembre de 2026 se subieron a `main` once plantillas que
Word declaraba dañadas y no abría. Ni python-docx ni LibreOffice las rechazaban
—los dos son permisivos—, así que no había forma de detectarlo sin abrir Word a
mano. El esquema sí las rechaza, y en el sitio exacto.
