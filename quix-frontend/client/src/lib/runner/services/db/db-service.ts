'use strict';
import {inject} from '../../../core';
import angular from 'angular';

export interface IAutocomplete {
  value: string;
  meta: string;
}

export interface IDbNode {
  name: string;
  type: string;
  children: IDbNode[];
}

export class DbInfo {
  private readonly $http: angular.IHttpService = inject('$http');

  constructor(private readonly type: string, private readonly apiBasePath = '') {}

  fetchAllKeywords(): Promise<IAutocomplete[]> {
    return this.$http<any>({
      url: `${this.apiBasePath}/api/autocomplete/${this.type}`,
      method: 'GET'
    })
      .then(({data}) => data)
      .catch(e => console.log(e)) as any;
  }

  fetchSchema(): Promise<IDbNode[]> {
    return this.$http<any>({
      url: `${this.apiBasePath}/api/db/${this.type}/explore`,
      method: 'GET'
    })
      .then(({data}) => data)
      .catch(e => []) as any;
  }
}
