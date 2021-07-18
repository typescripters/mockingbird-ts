import { Property } from '@mockinbird/reflect';
import { Type } from '@mockinbird/types';
import { AbstractValueHandler } from './abstract-value-handler';
import { ValueHandler } from '../types/value-handler.interface';
import { isPrimitive } from '../common/is-primitive';

export class SingleClassValueHandler extends AbstractValueHandler implements ValueHandler {
  public shouldHandle(property: Property): boolean {
    return property.decoratorValue.isFunction() && !isPrimitive(property.constructorName);
  }

  public produceValue(propertyDto: Property): any {
    return this.classParser.parse(propertyDto.decoratorValue.value as Type);
  }
}
