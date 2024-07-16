import express, { Request, Response } from 'express';
import axios from 'axios';
import NodeCache from 'node-cache';

const app = express();
const port: number = 3000;

//Create a cache with an expiration time of 60 seconds
const cache = new NodeCache({ stdTTL: 60 });

//Define an interface for the items we expect to fetch
interface Item {
  fileUrl: string;
}


//Define the target IP address for filtering URLs
const targetIp = '34.8.32.234';

//Fetch and transform data function
const fetchData = async () => {
  try {
    const response = await axios.get('https://rest-test-eight.vercel.app/api/test');
    const data = response.data.items as Item[];

    //Filter out non-ASCII URLs and URLs not matching the target IP
    const urls: string[] = data.map(item => item.fileUrl).filter(url => /^[\x20-\x7E]+$/.test(url));
    const filteredUrls = urls.filter(url => {
      const parsedUrl = new URL(url);
      return parsedUrl.hostname === targetIp;
    });

    //Organize URLs into directories and files
    const subdirectories: Record<string, { subDirs: Record<string, Set<string>>, files: Set<string> }> = {};

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
          //Handle <directory>/<file>
          subdirectories[directory].files.add(pathParts[1]);
        } else if (pathParts.length > 2) {
          //Handle <directory>/<sub-directory>/<file>
          const subDirectory = pathParts[1];
          const file = pathParts.slice(2).join('/');

          //Initialize the subdirectory entry if it doesn't exist
          if (!subdirectories[directory].subDirs[subDirectory]) {
            subdirectories[directory].subDirs[subDirectory] = new Set<string>();
          }
          subdirectories[directory].subDirs[subDirectory].add(file);
        }
      } else {
        if (pathParts.length === 2) {
          //Handle <directory>/<sub-directory>
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

    return result

  } catch (error) {
    console.error('Error fetching data:', error);
    throw new Error('Error fetching data');
  }
};

//Asynchronous cache refresh
const refreshCache = async () => {
  const data = await fetchData();
  cache.set('filesData', data);
};

//Initial data fetch
refreshCache();
//Cache refresh
setInterval(refreshCache, 60000);

//Endpoint for fetching data from the cache
app.get('/api/files', async (req: Request, res: Response) => {
  const cachedData = cache.get('filesData');
  if (cachedData) {
    res.json(cachedData);
  } else {
    try {
      const data = await fetchData();
      cache.set('filesData', data);
      res.json(data);
    } catch (error) {
      res.status(500).send('Error fetching data');
    }
  }
});

//Start the server and listen on the specified port
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
