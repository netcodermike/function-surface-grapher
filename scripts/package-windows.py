"""Build a portable Windows x64 ZIP using the pinned Electron distribution."""

from argparse import ArgumentParser
from hashlib import sha256
from pathlib import Path
from shutil import copyfileobj
from tempfile import TemporaryDirectory, gettempdir
from urllib.request import Request, urlopen
from zipfile import ZIP_DEFLATED, ZipFile


ROOT = Path(__file__).resolve().parents[1]
TEMP = Path(gettempdir())
ELECTRON_VERSION = "45.4.1"
RUNTIME_FILENAME = f"electron-v{ELECTRON_VERSION}-win32-x64.zip"
RUNTIME_URL = (
    f"https://github.com/electron/electron/releases/download/v{ELECTRON_VERSION}/{RUNTIME_FILENAME}"
)
# From SHASUMS256.txt in the same upstream release.
RUNTIME_SHA256 = "2ba6223afa9121f42831fefe92c434334907540165294fc56697449d12e7cfe9"
APP_DIRECTORY = "FunctionAndSurfaceGrapher"
PACKAGE_FILENAME = f"{APP_DIRECTORY}-win-x64.zip"
APP_FILES = (
    "package.json",
    "electron/main.cjs",
    "index.html",
    "style.css",
    "app.mjs",
    "sampling.mjs",
)


def checksum(path):
    digest = sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def runtime_archive(cache_directory):
    cache_directory.mkdir(parents=True, exist_ok=True)
    cached = cache_directory / RUNTIME_FILENAME
    if cached.is_file() and checksum(cached) == RUNTIME_SHA256:
        return cached

    print(f"Downloading Electron {ELECTRON_VERSION} for Windows x64", flush=True)
    request = Request(RUNTIME_URL, headers={"User-Agent": "SurfingCoder Grapher packaging"})
    with TemporaryDirectory(prefix="electron-download-", dir=cache_directory) as temporary:
        download = Path(temporary) / RUNTIME_FILENAME
        with urlopen(request, timeout=60) as source, download.open("wb") as destination:
            copyfileobj(source, destination, length=1024 * 1024)
        if checksum(download) != RUNTIME_SHA256:
            raise ValueError("Electron download does not match the upstream SHA-256.")
        download.replace(cached)
    return cached


def package(runtime, output_directory):
    output_directory.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix="grapher-package-", dir=output_directory) as temporary:
        archive = Path(temporary) / PACKAGE_FILENAME
        print(f"Creating {PACKAGE_FILENAME}", flush=True)
        with ZipFile(runtime) as electron, ZipFile(archive, "w", compression=ZIP_DEFLATED) as bundle:
            for entry in electron.infolist():
                # Keep the upstream Electron and Chromium license files with the runtime.
                if entry.is_dir() or entry.filename == "resources/default_app.asar":
                    continue
                name = f"{APP_DIRECTORY}.exe" if entry.filename == "electron.exe" else entry.filename
                with electron.open(entry) as source, bundle.open(f"{APP_DIRECTORY}/{name}", "w") as destination:
                    copyfileobj(source, destination, length=1024 * 1024)

            for name in APP_FILES:
                with (ROOT / name).open("rb") as source:
                    with bundle.open(f"{APP_DIRECTORY}/resources/app/{name}", "w") as destination:
                        copyfileobj(source, destination)

        digest = checksum(archive)
        manifest = archive.with_suffix(".zip.sha256")
        manifest.write_text(f"{digest}  {PACKAGE_FILENAME}\n", encoding="ascii")
        result = archive.replace(output_directory / archive.name)
        manifest.replace(output_directory / manifest.name)
    print(f"{result}\nSHA-256 {digest}", flush=True)


if __name__ == "__main__":
    parser = ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=TEMP / "surfingcoder-grapher-dist")
    parser.add_argument("--cache-dir", type=Path, default=TEMP / "surfingcoder-electron")
    arguments = parser.parse_args()
    package(runtime_archive(arguments.cache_dir), arguments.output_dir.resolve())
