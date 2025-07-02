### WebUI (React as single html file)

### Barrel Pattern (import/no-internal-modules)

Files inside the features folder must be imported only through the index.ts file.

1. Example: import { Foo } from 'features/bar' (O)
2. Example: import { Foo } from 'features/bar/Foo' (X)

> This rule is applied to encapsulate internal functionality and to clearly manage dependencies between modules.
