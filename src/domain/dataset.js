import { createAction, handleActions } from "redux-actions";
import {
  chain,
  concat,
  find,
  fromPairs,
  identity,
  is,
  map,
  merge,
  path,
  pipe,
  propEq,
  sortBy,
  toPairs,
  uniq
} from "ramda";

const defaultState = {
  datasets: {}
};
const defaultItemState = {
  owner: "",
  dataset: [],
  filtered: null,
  values: {},
  configuration: {
    fields: []
  },
  isFetching: false,
  lastUpdated: null
};

/**
 * Return a string that uniquely identify the field
 */
const getFieldId = (field) => {
  if(field.path.length >= 1 && field.path[0])
    return field.path.join(".")
  else
    return " ";
}

/**
 * Returns an array of paths to literal values and arrays in a POJO.
 *
 * Example:
 * pathsIn({ a: 'A', b: { c: 'C', d: [1, 2] } }) //=> [['a'], ['b', 'c'], ['b', 'd']]
 */
const pathsIn = (obj) =>
  chain(
    ([key, value]) =>
      is(Object, value) ? map(concat([key]), pathsIn(value)) : [[key]],
    toPairs(obj)
  );

/**
 * Return all fields for an object
 */
const fieldsFor = (obj, overrides = []) => {
  const paths = pathsIn(obj);
  return map((path) => {
    const override = find(propEq('path', path), overrides) || {};
    return merge(
      {
        path: path,
        displayName: path.join('.'),
        groupable: true
      },
      override
    )
  }, paths);

  // var fields = difference(pathsIn(obj), map(prop('path'), overrides));
  // return [
  //   ...overrid,
  //   ...map(
  //     (path) => ({
  //       path: path,
  //       displayName: path.join("."),
  //       groupable: true
  //     }),
  //     unspecified
  //   )
  // ];
};

/**
 * Returns a configuration with any missing items populated
 */
const configurationFor = (dataset, configuration = {}) => {
  return {
    ...configuration,
    fields: fieldsFor(dataset[0] || {}, configuration.fields)
  };
};


const valuesFor = (dataset, configuration) => {
  return fromPairs(map((field) => {
    const values = pipe(
      map(path(field.path)),
      uniq,
      sortBy(identity)
    )(dataset);

    return [getFieldId(field), values];
  }, configuration.fields));
};


// ACTIONS

/**
 * Payload: {
 *   dataset: [], // Array of devices
 *   configuration: {} // Configuration
 * }
*/
const setDataset = createAction("SET_DATASET");
const setFilteredDataset = createAction("SET_FILTERED_DATASET");
const removeDataset = createAction("REMOVE_DATASET");
const removeFilteredDataset = createAction("REMOVE_FILTERED_DATASET");
const setIsFetching = createAction("SET_IS_FETCHING");

// REDUCERS
const reducer = handleActions(
  {
    [setDataset]: (state, { payload }) => {
      const dataset = payload.dataset;
      const owner = payload.owner;
      const configuration = configurationFor(
        payload.dataset || [],
        payload.configuration || {}
      );

      const values = valuesFor(dataset, configuration);
      const isFetching = false;
      const lastUpdated = new Date();
      state.datasets[owner] = {
        dataset: dataset,
        filtered: null,
        values: values,
        configuration: configuration,
        isFetching: isFetching,
        lastUpdated: lastUpdated
      }
      return { ...state};
    },
    [setFilteredDataset]: (state, { payload }) => {
      const filtered = payload.filtered;
      const owner = payload.owner;

      state.datasets[owner].filtered = filtered;
      return { ...state};
    },
    [removeDataset]: (state, { payload }) => {
      const owner = payload.owner;
      if(state.datasets.hasOwnProperty(owner))
        delete state.datasets[owner];

      return { ...state }
    },
    [removeFilteredDataset]: (state, { payload }) => {
      const owner = payload.owner;
      if(state.datasets.hasOwnProperty(owner))
        state.datasets[owner].filtered = null;

      return { ...state }
    },
    [setIsFetching]: (state, { payload }) => {
      const owner = payload.owner;
      const isFetching = !!payload.isFetching;
      if(state.datasets.hasOwnProperty(owner))
        state.datasets[owner].isFetching = isFetching;
      return { ...state, isFetching};
    }
  },
  defaultState
);

// SELECTORS

const selectDataset = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].dataset ? state.dataset.datasets[owner].dataset : defaultItemState.dataset;
const selectFilteredDataset = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].filtered ? state.dataset.datasets[owner].filtered : defaultItemState.filtered;
const selectConfiguration = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].configuration ? state.dataset.datasets[owner].configuration : defaultItemState.configuration;
const selectMergedConfiguration = (state) => {
  let fields = [];
  const ds = state.dataset.datasets;
  for (var key in ds){
    for (var f of ds[key].configuration.fields){ 
      // eslint-disable-next-line no-loop-func
      if(!fields.some(field => field.displayName === f.displayName)){
        fields.push(f);
      }
    }
  }

  return { fields: fields };
}
const selectValues = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].values ? state.dataset.datasets[owner].values : defaultItemState.values;
const selectMergedValues = (state) => {
  let vals = {};
  const ds = state.dataset.datasets;
  for (var key in ds){
    for (var v in ds[key].values){
      if(vals.hasOwnProperty(v)){
        const valSet = new Set([...vals[v], ...ds[key].values[v]]);
        vals[v] = [...valSet];
      }
      else {
        vals[v] = ds[key].values[v];
      }
    }
  }

  return vals;
}
const getIsFetching = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].isFetching ? state.dataset.datasets[owner].isFetching : defaultItemState.isFetching;
const getLastUpdated = (state, owner) => state.dataset.datasets[owner] && state.dataset.datasets[owner].lastUpdated ? state.dataset.datasets[owner].lastUpdated : defaultItemState.lastUpdated;


export default reducer;

export { setDataset, selectDataset, removeDataset, setFilteredDataset, selectFilteredDataset, removeFilteredDataset, selectConfiguration, selectMergedConfiguration, selectValues, 
  selectMergedValues, getFieldId, configurationFor, setIsFetching, getIsFetching, getLastUpdated };
