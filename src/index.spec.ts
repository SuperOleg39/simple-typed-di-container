import { Container, createToken } from "./index";

describe("createToken", () => {
  it("description", () => {
    const token = createToken<string>("token");
    expect(String(token)).toBe("token");
  });
});

describe("Container", () => {
  it("provide value", () => {
    const di = new Container();
    const token = createToken<string>("token");

    di.provide({
      token,
      value: "value",
    });

    expect(di.resolve(token)).toBe("value");
  });

  it("provide factory", () => {
    const di = new Container();
    const valueToken = createToken<string>("valueToken");
    const factoryToken = createToken<string>("factoryToken");

    di.provide({
      token: valueToken,
      value: "value",
    });

    di.provide({
      token: factoryToken,
      factory: ({ value }: { value: string }) => value,
      deps: {
        value: valueToken,
      },
    });

    expect(di.resolve(factoryToken)).toBe("value");
  });

  it("provide service", () => {
    const di = new Container();
    const valueToken = createToken<string>("valueToken");
    const serviceToken = createToken<{ value: string }>("serviceToken");

    di.provide({
      token: valueToken,
      value: "value",
    });

    di.provide({
      token: serviceToken,
      service: class Service {
        value: string;
        constructor({ value }: { value: string }) {
          this.value = value;
        }
      },
      deps: {
        value: valueToken,
      },
    });

    expect(di.resolve(serviceToken).value).toBe("value");
  });

  it("provide multi value", () => {
    const di = new Container();
    const token = createToken<string>("token", { multi: true });

    di.provide({
      token,
      value: "value1",
    });

    di.provide({
      token,
      value: "value2",
    });

    expect(di.resolve<string, true>(token)).toEqual(["value1", "value2"]);
  });

  it("provide multi factory", () => {
    const di = new Container();
    const valueToken = createToken<string>("valueToken");
    const factoryToken = createToken<string>("factoryToken", { multi: true });

    di.provide({
      token: valueToken,
      value: "value1",
    });

    di.provide({
      token: factoryToken,
      factory: ({ value }: { value: string }) => value,
      deps: {
        value: valueToken,
      },
    });

    di.provide({
      token: factoryToken,
      factory: () => "value2",
    });

    expect(di.resolve<string, true>(factoryToken)).toEqual([
      "value1",
      "value2",
    ]);
  });

  it("provide multi service", () => {
    const di = new Container();
    const valueToken = createToken<string>("valueToken");
    const serviceToken = createToken<{ value: string }>("serviceToken", {
      multi: true,
    });

    di.provide({
      token: valueToken,
      value: "value1",
    });

    di.provide({
      token: serviceToken,
      service: class Service {
        value: string;
        constructor({ value }: { value: string }) {
          this.value = value;
        }
      },
      deps: {
        value: valueToken,
      },
    });

    di.provide({
      token: serviceToken,
      service: class Service {
        value: string;
        constructor() {
          this.value = "value2";
        }
      },
    });

    expect(di.resolve<{ value: string }, true>(serviceToken)).toEqual([
      { value: "value1" },
      { value: "value2" },
    ]);
  });

  it("mixed providers", () => {
    const di = new Container();
    const token = createToken<string | { name: string }>("mixed", {
      multi: true,
    });

    di.provide({
      token,
      value: "value",
    });

    di.provide({
      token,
      factory: () => "factory",
    });

    di.provide({
      token,
      service: class Service {
        name: string;
        constructor() {
          this.name = "service";
        }
      },
    });

    expect(di.resolve<string | { name: string }, true>(token)).toEqual([
      "value",
      "factory",
      { name: "service" },
    ]);
  });

  it("resolve not registered token throw error", () => {
    const di = new Container();
    const token = createToken<string>("token");

    expect(() => di.resolve(token)).toThrow(
      "Provider for token is not registered!"
    );
  });

  it("resolve not registered optional token return null", () => {
    const di = new Container();
    const token = createToken<string>("token", { optional: true });

    expect(di.resolve<string, false, true>(token)).toBe(null);
  });

  it("resolve not registered optional multi token return empty array", () => {
    const di = new Container();
    const token = createToken<string>("token", { multi: true, optional: true });

    expect(di.resolve<string, true, true>(token)).toEqual([]);
  });

  it("resolve factory on demand", () => {
    const di = new Container();
    const token = createToken<string>("token");
    const factory = jest.fn(() => "value");

    di.provide({
      token,
      factory,
    });

    expect(factory.mock.calls.length).toBe(0);
    di.resolve(token);
    expect(factory.mock.calls.length).toBe(1);
  });

  it("resolve service on demand", () => {
    const di = new Container();
    const token = createToken<{ test: () => void }>("token");
    const testMethodMock = () => {};
    const service = jest.fn().mockImplementation(() => {
      return { test: testMethodMock };
    });

    di.provide({
      token,
      service,
    });

    expect(service.mock.calls.length).toBe(0);
    di.resolve(token);
    expect(service.mock.calls.length).toBe(1);
  });

  it("child ignore parent multi provider updates", () => {
    const di = new Container();
    const token = createToken<string>("token", { multi: true });

    di.provide({
      token,
      value: "value1",
    });

    expect(di.resolve<string, true>(token)).toEqual(["value1"]);

    di.provide({
      token,
      value: "value2",
    });

    expect(di.resolve<string, true>(token)).toEqual(["value1"]);
  });

  it("optional provider dep not throw error", () => {
    const di = new Container();
    const factoryToken = createToken<string>("factory");
    const missedToken = createToken<string>("token");

    di.provide({
      token: factoryToken,
      factory: ({ token }: { token?: string }) => token ?? "token is missed",
      deps: {
        token: {
          token: missedToken,
          optional: true,
        },
      },
    });

    expect(() => di.resolve(factoryToken)).not.toThrow();
    expect(di.resolve(factoryToken)).toBe("token is missed");
  });

  it("fork create new container", () => {
    const di = new Container();

    expect(di.fork()).toBeInstanceOf(Container);
  });

  it("forked container have parent providers", () => {
    const di = new Container();
    const tokenA = createToken<string>("a");
    const tokenB = createToken<string>("b");
    const tokenC = createToken<{ name: string }>("c");

    di.provide({
      token: tokenA,
      value: "value",
    });

    di.provide({
      token: tokenB,
      factory: () => "factory",
    });

    di.provide({
      token: tokenC,
      service: class Service {
        name: string;
        constructor() {
          this.name = "service";
        }
      },
    });

    const child = di.fork();

    expect(child.resolve(tokenA)).toBe("value");
    expect(child.resolve(tokenB)).toBe("factory");
    expect(child.resolve(tokenC)).toEqual({ name: "service" });
  });

  it("forked container have parent multi providers", () => {
    const di = new Container();
    const tokenA = createToken<string>("a", { multi: true });
    const tokenB = createToken<string>("b", { multi: true });
    const tokenC = createToken<{ name: string }>("c", { multi: true });

    di.provide({
      token: tokenA,
      value: "value",
    });

    di.provide({
      token: tokenB,
      factory: () => "factory",
    });

    di.provide({
      token: tokenC,
      service: class Service {
        name: string;
        constructor() {
          this.name = "service";
        }
      },
    });

    const child = di.fork();

    expect(child.resolve<string, true>(tokenA)).toEqual(["value"]);
    expect(child.resolve<string, true>(tokenB)).toEqual(["factory"]);
    expect(child.resolve<{ name: string }, true>(tokenC)).toEqual([
      { name: "service" },
    ]);
  });

  it("forked container reuse values from parent for global providers", () => {
    const di = new Container();
    const tokenLocal = createToken<number>("tokenLocal");
    const tokenGlobal = createToken<number>("toktokenGlobalen", {
      scope: "global",
    });
    let localValue = 0;
    let globalValue = 0;

    di.provide({
      token: tokenLocal,
      factory: () => ++localValue,
    });

    di.provide({
      token: tokenGlobal,
      factory: () => ++globalValue,
    });

    expect(di.resolve(tokenLocal)).toBe(1);
    expect(di.resolve(tokenGlobal)).toBe(1);

    const child = di.fork();

    expect(child.resolve(tokenLocal)).toBe(2);
    expect(child.resolve(tokenGlobal)).toBe(1);
  });

  it("forked container register own providers", () => {
    const di = new Container();
    const child = di.fork();
    const token = createToken<string>("token");

    child.provide({
      token,
      value: () => "token",
    });

    expect(() => di.resolve(token)).toThrow();
    expect(() => child.resolve(token)).not.toThrow();
  });
});
