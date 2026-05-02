import { app } from './src/app.js';
import { config } from './src/config.js';

app.listen(config.PORT, () => {
  console.log(`Server listening on port http://localhost:${config.PORT}`);
});
