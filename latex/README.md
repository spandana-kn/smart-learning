# SmartFocus IEEE LaTeX Paper

This folder contains the IEEE-style LaTeX source for the SmartFocus paper.

## Files

- `main.tex` - main IEEE paper source.
- `references.bib` - bibliography entries in BibTeX format.
- `figures/` - editable TikZ diagrams.
- `tables/` - reusable table files.
- `appendix/` - appendix material.
- `Makefile` - local build and clean commands for machines with LaTeX installed.

## Build

On Overleaf, upload this entire `latex` folder and compile `main.tex`.
If figure references show section numbers such as `Fig. IV-A`, compile two or three times so LaTeX can refresh cross-references.

On a local machine with TeX Live or MiKTeX:

```bash
make
```

The current Codex environment did not have `pdflatex` or `bibtex` on PATH, so local compilation was not performed here.

## Notes Before Submission

- Add final author emails if your department requires them.
- Replace or supplement the TikZ diagrams with screenshots only if your guide asks for screenshots.
- Add real test logs if you have updated evaluation results after the report.
- Run a plagiarism check yourself after making final personal edits. No tool can honestly guarantee a fixed plagiarism or AI-detection score.
