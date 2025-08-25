import path from 'path';


const processedName = (name) => name.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
export const urlToFilename = (link, defaultFormat = '.html') => {
    const {dir, name, ext} = path.parse(link);
    const slug = processedName(path.join(dir, name));
    const format = ext ? ext : defaultFormat;
    return `${slug}${format}`;
};

export const urlToDirname = (link) => {
    const {dir, name} = path.parse(link);
    const slug = processedName(path.join(dir, name));
    return `${slug}_files`;
};

export const getExtension = (fileName) => {
    const ext = path.extname(fileName);
    return ext ? ext : '';
};

export const sanitizeOutputDir = (dir) => {
    const restrictedPaths = ["/sys","/dev", "/proc", "/etc", "/bin", "/lib", "/usr"];
    if (restrictedPaths.includes(dir)) {
        throw new Error(`Refusing to write to restricted directory: ${dir}`);
    }
    return dir;
};
