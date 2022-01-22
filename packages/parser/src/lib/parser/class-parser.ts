import { Container, Inject, Service } from 'typedi';
import { ClassPropsReflection, ClassReflector, Property } from '@mockingbird/reflect';
import { Class, Faker, LazyType } from '@mockingbird/common';
import { MutationsCallback, ParserConfig, ParsingStrategy } from '../types/types';
import { ValueHandler } from '../types/value-handler.interface';
import { EnumValueHandler } from '../handlers/enum-value-handler';
import { ArrayOfClassesValueHandler } from '../handlers/array-of-classes-value-handler';
import { FakerCallbackValueHandler } from '../handlers/faker-callback-value-handler';
import { ObjectLiteralValueHandler } from '../handlers/object-literal-value-handler';
import { PrimitiveValueHandler } from '../handlers/primitive-value-handler';
import { RegexValueHandler } from '../handlers/regex-value-handler';
import { ClassCallbackHandler } from '../handlers/class-callback-handler';

@Service()
export class ClassParser<TClass = any> {
  private readonly valueHandlers: Class<ValueHandler>[] = [
    FakerCallbackValueHandler,
    ArrayOfClassesValueHandler,
    ClassCallbackHandler,
    EnumValueHandler,
    RegexValueHandler,
    ObjectLiteralValueHandler,
    PrimitiveValueHandler,
  ];

  public constructor(@Inject('Faker') private readonly faker: Faker) {}

  private static isClassIncludesClassName(prop: Property, ctorName: string) {
    return (prop.propertyValue.decorator.value as LazyType)().name === ctorName;
  }

  private handlePropertyValue(property: Property, reference: string = undefined): TClass | TClass[] {
    for (const classHandler of this.valueHandlers) {
      const handler = Container.get<ValueHandler>(classHandler);

      if (handler.shouldHandle(property)) {
        if (classHandler.name === ClassCallbackHandler.name) {
          if (reference && ClassParser.isClassIncludesClassName(property, reference)) {
            return undefined;
          }

          return handler.produceValue<TClass>(property, { reference });
        }

        return handler.produceValue<TClass>(property);
      }
    }
  }

  public parse(targetClass: Class<TClass>, config: ParserConfig<TClass> = {}): TClass {
    const classReflection = ClassReflector.getInstance().reflectClass(targetClass);
    const { omit = [], pick = [] } = config;

    let { mutations = {} } = config;
    let strategy: ParsingStrategy;

    if (omit.length) {
      strategy = 'omit';
    } else if (pick.length) {
      strategy = 'pick';
    }

    if (omit.length && pick.length) {
      throw new Error('Can not use pick and omit at the same time');
    }

    if (typeof mutations === 'function') {
      mutations = (mutations as MutationsCallback<TClass>)(this.faker);
    }

    const deriveFromProps = (acc, property) => {
      let value;

      if (mutations.hasOwnProperty(property.name)) {
        value = mutations[property.name];
      }

      if (strategy == 'pick') {
        if (pick.includes(property.name)) {
          return { ...acc, [property.name]: value || this.handlePropertyValue(property) };
        }

        return acc;
      }

      if (omit.includes(property.name) && strategy == 'omit') {
        return acc;
      }

      const propFinalValue = value || this.handlePropertyValue(property, config.reference ?? targetClass.name);

      if (!propFinalValue) {
        return acc;
      }

      return {
        [property.name]: propFinalValue,
        ...acc,
      };
    };

    const derivedProps = classReflection.reduce(deriveFromProps, {});
    return Object.assign(new targetClass(), derivedProps);
  }
}
