type Token<T = any> = Readonly<{
  key: symbol;
  options?: TokenOptions;
  __typeBrand: T;
}>;

type TokenOptions = {
  multi?: boolean;
  optional?: boolean;
  scope?: "local" | "global";
};

export type ExtractTokenType<T> = T extends Token<infer Type> ? Type : never;

export function createToken<T>(name: string, options?: TokenOptions): Token<T> {
  return Object.freeze({
    options,
    key: Symbol(name),
    toString: () => name,
  } as Token<T>);
}

type ProviderOptions = {};

type BaseDeps = Record<
  string,
  | Token<any>
  | {
      token: Token<any>;
      optional?: boolean;
    }
>;

type Deps<ValueDeps> = {
  [Key in keyof ValueDeps]:
    | Token<ValueDeps[Key]>
    | {
        token: Token<ValueDeps[Key]>;
        optional?: boolean;
      };
};

type BaseProvider<T> = {
  token: Token<T>;
  options?: ProviderOptions;
};

type ValueProvider<T> = {
  value: T;
} & BaseProvider<T>;

type FactoryProviderWithoutDeps<T> = {
  factory: () => T;
} & BaseProvider<T>;

type FactoryProviderWithDeps<T> = {
  factory: (deps: Record<string, any>) => T;
  deps: BaseDeps;
} & BaseProvider<T>;

type ServiceProviderWithoutDeps<T> = {
  service: new () => T;
} & BaseProvider<T>;

type ServiceProviderWithDeps<T> = {
  service: new (deps: Record<string, any>) => T;
  deps: BaseDeps;
} & BaseProvider<T>;

type Provider<T> =
  | ValueProvider<T>
  | FactoryProviderWithoutDeps<T>
  | FactoryProviderWithDeps<T>
  | ServiceProviderWithoutDeps<T>
  | ServiceProviderWithDeps<T>;

export class Container {
  private providers: Map<symbol, Provider<any> | Provider<any>[]> = new Map();
  private values: Map<symbol, any | any[]> = new Map();

  constructor(protected parent?: Container) {}

  provide<T, SD extends Record<string, any>, D extends Deps<SD>>(provider: {
    token: Token<T>;
    service: new (deps: SD) => T;
    deps: D;
    options?: ProviderOptions;
  }): void;
  provide<T>(provider: {
    token: Token<T>;
    service: new () => T;
    options?: ProviderOptions;
  }): void;
  provide<T, FD extends Record<string, any>, D extends Deps<FD>>(provider: {
    token: Token<T>;
    factory: (deps: FD) => T;
    deps: D;
    options?: ProviderOptions;
  }): void;
  provide<T>(provider: {
    token: Token<T>;
    factory: () => T;
    options?: ProviderOptions;
  }): void;
  provide<T>(provider: {
    token: Token<T>;
    value: T;
    options?: ProviderOptions;
  }): void;
  provide(provider: Provider<any>): void;
  provide(provider: never): void;
  provide<P extends Provider<any>>(provider: P) {
    const { token } = provider;
    const { key, options: { multi = false } = {} } = token;

    if (multi) {
      if (!this.providers.has(key)) {
        this.providers.set(key, []);
      }
      (this.providers.get(key) as Provider<any>[]).push(provider);
    } else {
      this.providers.set(key, provider);
    }
  }

  resolve<T, M = false, O = false>(
    token: Token<T>,
    options: {
      optional?: boolean;
    } = {}
  ): O extends true
    ? M extends true
      ? T[] | []
      : T | null
    : M extends true
    ? T[]
    : T {
    const {
      key,
      options: { multi = false, optional = false, scope = "local" } = {},
    } = token;
    let value: any;

    if (scope === "global" && this.parent) {
      const parentValue: any = this.parent.resolve(token);

      if (typeof parentValue !== undefined) {
        return parentValue;
      }
    }

    if (this.values.has(key)) {
      value = this.values.get(key);
    } else if (this.providers.has(key)) {
      const provider = this.providers.get(key) as
        | Provider<any>
        | Provider<any>[];

      if (multi) {
        value = [];

        (provider as Provider<any>[]).forEach((p) => {
          if ("value" in p) {
            value.push(p.value);
          } else if ("factory" in p) {
            if ("deps" in p) {
              value.push(p.factory(this.resolveDeps(p.deps)));
            } else {
              value.push(p.factory());
            }
          } else if ("service" in p) {
            if ("deps" in p) {
              value.push(new p.service(this.resolveDeps(p.deps)));
            } else {
              value.push(new p.service());
            }
          }
        });
      } else {
        if ("value" in provider) {
          value = provider.value;
        } else if ("factory" in provider) {
          if ("deps" in provider) {
            value = provider.factory(this.resolveDeps(provider.deps));
          } else {
            value = provider.factory();
          }
        } else if ("service" in provider) {
          if ("deps" in provider) {
            value = new provider.service(this.resolveDeps(provider.deps));
          } else {
            value = new provider.service();
          }
        }
      }
    } else {
      if (optional || options.optional) {
        return multi ? ([] as any) : (null as any);
      } else {
        throw new Error(`Provider for ${token} is not registered!`);
      }
    }

    this.values.set(key, value);

    return this.values.get(key);
  }

  resolveDeps(deps: BaseDeps) {
    return Object.entries(deps).reduce((resolvedDeps, [key, value]) => {
      if ("token" in value) {
        const { token, optional } = value;
        resolvedDeps[key] = this.resolve(token, { optional });
      } else {
        resolvedDeps[key] = this.resolve(value);
      }
      return resolvedDeps;
    }, {} as Record<string, any>);
  }

  fork(): Container {
    const child = new Container(this);

    this.providers.forEach((provider: Provider<any> | Provider<any>[]) => {
      if (Array.isArray(provider)) {
        provider.forEach((p) => {
          child.provide(p);
        });
      } else {
        child.provide(provider);
      }
    });

    return child;
  }
}
