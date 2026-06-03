Now pay attention how we are managing state in the @contextScopeItemMention

how we have defined what we would like to store in url
with type for each value, default value, encoder to url and decoder from url

const { useQueryParams, separateIndexedSearchParams } = modURLSearchParams(

then that produces custom hook useQueryParams with function to extract list of all possible parameters this hook governs separateIndexedSearchParams

then how we are using it in the child component

const { params, updatedURLSearchParams, setParam, setParams } = useQueryParams(search, navigate, i);

to get all parameters in params object and to get two methods to manipulate/update/change values for each param

setParam, setParams

use this technique of managing states in url in this example and .... continue here
