"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const axios_1 = __importDefault(require("axios"));
const node_cache_1 = __importDefault(require("node-cache"));
const app = (0, express_1.default)();
const port = 3000;
//Create a cache with an expiration time of 60 seconds
const cache = new node_cache_1.default({ stdTTL: 60 });
//Define the target IP address for filtering URLs
const targetIp = '34.8.32.234';
//Fetch and transform data function
const fetchData = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const response = yield axios_1.default.get('https://rest-test-eight.vercel.app/api/test');
        const data = response.data.items;
        //Filter out non-ASCII URLs and URLs not matching the target IP
        const urls = data.map(item => item.fileUrl).filter(url => /^[\x20-\x7E]+$/.test(url));
        const filteredUrls = urls.filter(url => {
            const parsedUrl = new URL(url);
            return parsedUrl.hostname === targetIp;
        });
        //Organize URLs into directories and files
        const subdirectories = {};
        filteredUrls.forEach(url => {
            const parsedUrl = new URL(url);
            const pathParts = parsedUrl.pathname.split('/').filter(part => part);
            const directory = pathParts[0];
            const isFile = /\.\w+$/.test(pathParts[pathParts.length - 1]);
            //Initialize the directory entry if it doesn't exist
            if (!subdirectories[directory]) {
                subdirectories[directory] = { subDirs: {}, files: new Set() };
            }
            if (isFile) {
                if (pathParts.length === 2) {
                    //Case for <directory>/<file>
                    subdirectories[directory].files.add(pathParts[1]);
                }
                else if (pathParts.length > 2) {
                    //Case for <directory>/<sub-directory>/<file>
                    const subDirectory = pathParts[1];
                    const file = pathParts.slice(2).join('/');
                    //Initialize the subdirectory entry if it doesn't exist
                    if (!subdirectories[directory].subDirs[subDirectory]) {
                        subdirectories[directory].subDirs[subDirectory] = new Set();
                    }
                    subdirectories[directory].subDirs[subDirectory].add(file);
                }
            }
            else {
                if (pathParts.length === 2) {
                    //Case for <directory>/<sub-directory>
                    const subDirectory = pathParts[1];
                    subdirectories[directory].subDirs[subDirectory] = new Set();
                }
            }
        });
        //Prepare the result object
        const result = {
            [targetIp]: Object.entries(subdirectories).map(([directory, { subDirs, files }]) => {
                const subDirEntries = Object.entries(subDirs).map(([subDir, filesSet]) => ({
                    [subDir]: Array.from(filesSet)
                }));
                //Combine subdirectory entries and files directly under the directory
                const filesEntry = { files: Array.from(files) };
                return {
                    [directory]: subDirEntries.concat(filesEntry)
                };
            })
        };
        return result;
    }
    catch (error) {
        console.error('Error fetching data:', error);
        throw new Error('Error fetching data');
    }
});
//Asynchronous cache refresh
const refreshCache = () => __awaiter(void 0, void 0, void 0, function* () {
    const data = yield fetchData();
    cache.set('filesData', data);
});
//Initial data fetch and cache refresh
refreshCache();
setInterval(refreshCache, 60000);
//Endpoint for fetching data from the cache
app.get('/api/files', (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const cachedData = cache.get('filesData');
    if (cachedData) {
        res.json(cachedData);
    }
    else {
        try {
            const data = yield fetchData();
            cache.set('filesData', data);
            res.json(data);
        }
        catch (error) {
            res.status(500).send('Error fetching data');
        }
    }
}));
// Start the server and listen on the specified port
app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
