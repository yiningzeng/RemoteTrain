--
-- PostgreSQL database dump
--

-- Dumped from database version 9.6.15
-- Dumped by pg_dump version 10.9 (Ubuntu 10.9-0ubuntu0.18.04.1)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_with_oids = false;

--
-- Name: train_record; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.train_record (
    id integer NOT NULL,
    project_id character varying(100) NOT NULL,
    container_id character varying(100),
    project_name character varying(100),
    status integer DEFAULT 0,
    net_framework character varying(50),
    assets_type character varying(50),
    assets_directory_base character varying(250),
    assets_directory_name character varying(100),
    create_time timestamp without time zone,
    is_jump integer DEFAULT 0
);


ALTER TABLE public.train_record OWNER TO postgres;

--
-- Name: COLUMN train_record.container_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.container_id IS '容器的id';


--
-- Name: COLUMN train_record.project_name; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.project_name IS '项目名';


--
-- Name: COLUMN train_record.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.status IS '0:等待解包
1:解包完成
2:正在训练
3:训练完成';


--
-- Name: COLUMN train_record.net_framework; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.net_framework IS '训练使用的框架';


--
-- Name: COLUMN train_record.assets_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.assets_type IS '训练的数据类型';


--
-- Name: COLUMN train_record.is_jump; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.train_record.is_jump IS '是否插队
0:正常
1:插队';


--
-- Name: table_name_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.table_name_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER TABLE public.table_name_id_seq OWNER TO postgres;

--
-- Name: table_name_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.table_name_id_seq OWNED BY public.train_record.id;


--
-- Name: train_record id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.train_record ALTER COLUMN id SET DEFAULT nextval('public.table_name_id_seq'::regclass);


--
-- Name: table_name_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.table_name_id_seq', 7, true);


--
-- Name: train_record train_record_id_pk; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.train_record
    ADD CONSTRAINT train_record_id_pk PRIMARY KEY (id);


--
-- PostgreSQL database dump complete
--

